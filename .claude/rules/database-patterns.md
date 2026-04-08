# Database Patterns

## Architecture

MongoDB is the single database for all data. Runs as a Docker container (`mongo:7`) in `docker-compose.yml`. Connection: `MONGODB_URI` env variable.

Two logical scopes:

| Scope | Access | Examples |
|-------|--------|---------|
| Per-team | `getSystemCollection(teamId, name)` / `getTableCollection(teamId, name)` | messages, subscribers, flows |
| System-wide | `getGlobalSystemCollection(name)` / `getSystemDb()` | users, teams, integrations |

## Multi-Tenancy

Separate database per team via `piece/multitenancy`. Each team gets its own MongoDB database (`team_{teamId}`).

### Collection Types

| Type | Prefix | Examples |
|------|--------|---------|
| System | (none) | `subscribers`, `messages`, `channels` |
| Table | `table_` | `table_customers`, `table_orders` |

### Collection Access

```javascript
import { getSystemCollection, getTableCollection } from 'piece/multitenancy';

// System collection -- no prefix
const messages = getSystemCollection(teamId, 'messages');

// Table collection -- automatic table_ prefix
const customers = getTableCollection(teamId, 'customers');
// Accesses: table_customers
```

### System Database

```javascript
import { getSystemDb, getGlobalSystemCollection } from 'piece/multitenancy';

// Synchronous -- no await
const systemDb = getSystemDb();
const users = getGlobalSystemCollection('users');
const teams = getGlobalSystemCollection('teams');
```

**NEVER use Mongoose in new services.** Use native MongoDB driver only via `piece/multitenancy`.

## MongoDB ID Handling

All ObjectId conversions MUST use `piece/validation/mongo`:

```javascript
import { mongoIdUtils } from 'piece/validation/mongo';

// Query: string -> ObjectId
const record = await collection.findOne({ _id: mongoIdUtils.toObjectId(id) });

// Response: ObjectId -> string
res.json({ id: mongoIdUtils.toApiString(record._id), name: record.name });

// PubSub events: always string IDs
await publishEvent('topic', {
  data: { subscriberId: mongoIdUtils.toApiString(subscriber._id) },
});
```

### Forbidden Patterns

```javascript
// WRONG -- never import ObjectId directly
import { ObjectId } from 'mongodb';
const record = await collection.findOne({ _id: new ObjectId(id) });

// CORRECT -- always use mongoIdUtils
import { mongoIdUtils } from 'piece/validation/mongo';
const record = await collection.findOne({ _id: mongoIdUtils.toObjectId(id) });
```

## Index Management

Indexes are centralized in two places. **NO lazy-loaded indexes, NO startup indexes in services.**

- **Per-team collections:** `initializeTeamDatabase(teamId)` -- called once when a team is provisioned
- **System collections:** `initializeSystemIndexes()` -- called once at system bootstrap

```javascript
// CORRECT: indexes defined in team initialization
async function initializeTeamDatabase(teamId) {
  const subscribers = getSystemCollection(teamId, 'subscribers');
  await subscribers.createIndex({ email: 1 }, { unique: true, sparse: true });
  await subscribers.createIndex({ createdAt: -1 });
}

// WRONG: creating indexes at service startup
app.listen(port, async () => {
  const collection = getSystemCollection(teamId, 'messages');
  await collection.createIndex({ chatId: 1 }); // FORBIDDEN
});
```

## Query Patterns

### Paginated List

```javascript
async function listRecords(teamId, { limit = 20, offset = 0, filter = {} }) {
  const collection = getSystemCollection(teamId, 'records');
  const [data, total] = await Promise.all([
    collection.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).toArray(),
    collection.countDocuments(filter),
  ]);

  return {
    data: data.map((r) => ({ id: mongoIdUtils.toApiString(r._id), ...r })),
    pagination: { total, limit, offset, hasMore: offset + limit < total },
  };
}
```

### Upsert

```javascript
async function upsertRecord(teamId, uniqueKey, data) {
  const collection = getSystemCollection(teamId, 'records');
  const result = await collection.findOneAndUpdate(
    { uniqueKey },
    { $set: { ...data, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true, returnDocument: 'after' },
  );
  return { id: mongoIdUtils.toApiString(result._id), ...result };
}
```

### Cursor-based Pagination

```javascript
async function listWithCursor(teamId, { limit = 20, cursor, direction = 'next' }) {
  const collection = getSystemCollection(teamId, 'records');
  const filter = cursor
    ? { _id: { [direction === 'next' ? '$gt' : '$lt']: mongoIdUtils.toObjectId(cursor) } }
    : {};
  const data = await collection.find(filter).sort({ _id: direction === 'next' ? 1 : -1 }).limit(limit).toArray();
  return {
    data: data.map((r) => ({ id: mongoIdUtils.toApiString(r._id), ...r })),
    pagination: { hasMore: data.length === limit, cursor: data[data.length - 1]?._id?.toString(), direction, limit },
  };
}
```

## Redis Caching

Use `piece/cache` with StandardTTL constants. NEVER hardcode TTL values.

```javascript
import { createCache, StandardTTL } from 'piece/cache';

const cache = createCache({ prefix: 'users' });
await cache.set(`user:${userId}`, profile, StandardTTL.LONG);
```

| Constant | Seconds | Use Case |
|----------|---------|----------|
| `SHORT` | 60 | Temporary/volatile data |
| `MEDIUM` | 300 | Default cache TTL |
| `LONG` | 3600 | Stable reference data |

## Vector Search (Optional)

If using Qdrant for vector search:

- **Graceful degradation:** `initializeQdrant()` retries 3x with exponential backoff (2/4/8s). Service starts in degraded mode on failure.
- **Null-guards:** Write ops are skipped, read/search ops return `[]` when Qdrant unavailable.
- Use `isQdrantAvailable()` to check status before operations.

## Anti-patterns

- **NEVER** use Mongoose in new services -- native MongoDB driver via `piece/multitenancy`
- **NEVER** import `ObjectId` from `mongodb` -- use `mongoIdUtils` from `piece/validation/mongo`
- **NEVER** create indexes at service startup -- centralize in `initializeTeamDatabase()`
- **NEVER** access another service's collections directly -- use PubSub or API Gateway
- **NEVER** store ObjectIds as strings in MongoDB -- store as ObjectId, convert on API boundary
