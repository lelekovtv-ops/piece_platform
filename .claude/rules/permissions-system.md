# Permissions System

## Overview

Three-layer authorization: RBAC (role hierarchy) + ABAC (scope filters) + ReBAC (resource-level access).

Location: `packages/permissions/src/`

## System Roles (Hierarchical)

| Role | Level | Default Scope | Description |
|------|-------|---------------|-------------|
| OWNER | 3 | `all` | Full access including billing and team deletion |
| ADMIN | 2 | `all` | Manage users, settings, and all content |
| MANAGER | 1 | `my` | Own content + limited team management |

Levels 2+ (admin, owner) get **all permissions** automatically.

## System Entities (47 total)

```
USERS, TEAMS, PROJECTS, SCREENPLAYS, RUNDOWNS, BIBLES, PIPELINES,
GENERATIONS, LIBRARY, TIMELINE, STORYBOARD, FLOWS, FLOW_GROUPS,
FLOW_VERSIONS, DATABASES, TABLES, CHANNELS, INTEGRATIONS, CHATS,
CHAT_GROUPS, AI_AGENTS, AI_KNOWLEDGE, KNOWLEDGE_BASES, MARKETPLACE,
BILLING, SECRETS, EVENTS, MEDIA, DRIVES, REPOSITORIES, SESSIONS,
NOTIFICATIONS, ROLES, PERMISSIONS, INTERNAL_CHATS, TAGS, MCP,
API_TOKENS, TASKS, TASK_TEMPLATES
```

## Actions

`READ`, `WRITE`, `DELETE`, `MANAGE`, `EXPORT`

## Scope Types (ABAC)

| Type | Value | Behavior |
|------|-------|----------|
| ALL | `'all'` | Access all resources in team |
| MY | `'my'` | Access only own resources (`createdBy === userId`) |

## Manager Denial List

Managers (level 1) are **denied** these specific actions:

```javascript
{
  teams:       ['delete', 'manage'],
  roles:       ['write', 'delete', 'manage'],
  permissions: ['write', 'delete', 'manage'],
  billing:     ['manage']
}
```

All other entity:action combinations are allowed for managers.

## Permission Evaluation Flow

```
requirePermission(entity, action)
  1. No user?                              → 401 UNAUTHORIZED
  2. Role not in cache?                    → 403 FORBIDDEN
  3. System role level >= 2 (admin/owner)? → ALLOW
  4. System role level === 1 (manager)?
     - In denial list?                     → 403 FORBIDDEN
     - Otherwise                           → ALLOW
  5. Custom role?
     - role.permissions[entity] has action? → ALLOW
     - Otherwise                           → check API token scopes
  6. API token scope match?                → ALLOW
  7. Otherwise                             → 403 FORBIDDEN
```

## Scope Filter (ABAC)

```
requireScopeFilter(entity)
  1. role.scopeOverrides[entity] exists?   → use override
  2. Otherwise                             → use role.defaultScope
  3. Fallback                              → ScopeTypes.MY
```

Services use `req.scopeFilter` to apply:
- `'all'` → no filter
- `'my'` → `{ createdBy: req.user.id }`

## Resource Access (ReBAC)

### Types

| Category | Values |
|----------|--------|
| Subject types | `user`, `role`, `agent` |
| Resource types | `knowledge_base`, `knowledge_category`, `drive`, `folder`, `database`, `table`, `repository`, `secret` |
| Access levels | `full` (3), `write` (2), `read` (1), `denied` (100) |

### Resource Inheritance

Child → Parent:
```
KNOWLEDGE_CATEGORY → KNOWLEDGE_BASE
FOLDER             → DRIVE
TABLE              → DATABASE
```

### Resolution Algorithm

```javascript
const resolver = new ResourceAccessResolver(teamId);
const access = await resolver.resolveEffectiveAccess({
  subjectType: 'user', subjectId,
  resourceType: 'knowledge_base', resourceId,
});
```

1. Query direct rules on resource (from `resource_access_rules` collection)
2. Include inherited rules from parent resource
3. If `DENIED` rule exists → return `DENIED` (always wins)
4. Return highest priority non-denied level

### List Accessible Resources

```javascript
const resourceIds = await resolver.listAccessible({
  subjectType: 'user', subjectId,
  resourceType: 'drive',
});
```

## Custom Roles

Loaded from MongoDB `roles` collection on init. Override system roles by name.

```javascript
{
  name: string,
  level: number,          // 0+ (system roles: 1-3)
  defaultScope: 'all' | 'my',
  permissions: { [entity]: [action1, action2] },
  scopeOverrides: { [entity]: 'all' | 'my' }
}
```

Custom roles use **explicit allow-list** (unlike system roles which use hierarchy + denial list).

## Initialization

```javascript
import { initializePermissions } from '@piece/permissions';

await initializePermissions(getSystemDb(), { config });
```

Loads system roles + custom roles from DB into in-memory `_rolesCache` Map. No dynamic reload without reinitializing.

## Middleware Usage

```javascript
import { requirePermission, requireScopeFilter, requireTeamSelection, requireTeamAccess } from '@piece/permissions';

router.get('/v1/resource',
  authenticateToken,
  requireTeamSelection(),
  requireTeamAccess(),
  requirePermission('resource', 'read'),
  requireScopeFilter('resource'),
  controller.list
);
```

**`requireTeamAccess()`** queries `team_members` collection, validates active/invited membership, attaches `req.user.teamRole`.

## MongoDB Collections

| Collection | Scope | Purpose |
|------------|-------|---------|
| `roles` | System DB | Custom role definitions |
| `team_members` | System DB | Team membership + roles |
| `resource_access_rules` | Per-team | ReBAC rules |

## Anti-patterns

- **NEVER** hardcode role checks (e.g., `if role === 'admin'`) -- use `requirePermission()`
- **NEVER** skip `requireTeamAccess()` before permission checks
- **NEVER** modify `_rolesCache` directly -- use DB + reinitialize
- **NEVER** assume `FULL` access without checking ReBAC rules when resource-level access is involved
