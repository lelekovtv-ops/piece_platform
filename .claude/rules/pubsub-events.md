# PubSub Events

## Transport: NATS JetStream

All inter-service messaging uses **NATS JetStream** via `piece/pubsub` package.

## Unified Event Structure

ALL events follow this structure:

```javascript
{
  type: 'domain:action',        // Required -- event type identifier
  data: { /* payload */ },      // Required -- event-specific data
  correlationId: 'uuid-v4',     // Required -- trace ID across services
  source: '{service-name}',     // Required -- originating service
  timestamp: 'ISO-8601',        // Required -- event creation time
  priority: 'normal'            // Optional -- 'low', 'normal', 'high', 'critical'
}
```

**ALL events MUST be validated via `piece/validation`** before publishing.

```javascript
import { validateEvent } from 'piece/validation';
import { publishEvent } from 'piece/pubsub';

const event = {
  type: 'message:inbound',
  data: { chatId, text, platform: 'telegram' },
  correlationId: req.headers['x-correlation-id'] || uuidv4(),
  source: '{service-name}',
  timestamp: new Date().toISOString(),
};

validateEvent(event); // Throws on invalid structure
await publishEvent('inbound-messages', event);
```

## NATS Initialization

```javascript
import { initializePubSub } from 'piece/pubsub';

await initializePubSub(config, { serviceName: '{service-name}' });
```

Connection: `NATS_URL` env variable (default: `nats://nats:4222` in Docker).

## Subject Format

Subjects follow the pattern `{prefix}.{domain}.{action}.{key}`:

```javascript
import { subjects } from 'piece/pubsub/subjects';

subjects.messageInbound(chatId)      // {prefix}.msg.inbound.{chatId}
subjects.messageOutbound(chatId)     // {prefix}.msg.outbound.{chatId}
subjects.aiStreaming(sessionId)      // {prefix}.ai.streaming.{sessionId}
subjects.billingEvents(teamId)       // {prefix}.billing.events.{teamId}
subjects.knowledgeEvents(teamId)     // {prefix}.knowledge.events.{teamId}
subjects.tableEvents(teamId)         // {prefix}.tables.events.{teamId}
subjects.dlq(domain)                 // {prefix}.dlq.{domain}
```

## Event Factories

Use domain-specific factory functions for type-safe event creation:

```javascript
import { MessageEvents } from 'piece/validation/events';

const event = MessageEvents.inbound(
  { chatId: '123', text: 'Hello', subscriberId: 'sub_456', platform: 'telegram' },
  '{service-name}',
  correlationId
);

await publishEvent(subjects.messageInbound(chatId), event);
```

### Factory Pattern

Each domain has a factory module exporting typed event creators:

```javascript
// events/billing.js
export const BillingEvents = {
  deducted: (data, source, correlationId) => ({
    type: 'billing:usage:deducted',
    data,
    source,
    correlationId,
    timestamp: new Date().toISOString(),
  }),
  balanceLow: (data, source, correlationId) => ({ /* ... */ }),
};
```

## Stream Configuration

| Property | File Storage | Memory Storage |
|----------|-------------|----------------|
| Retention | Long-lived events | Volatile/real-time |
| Max age | Hours to days | Minutes |
| Use case | Audit, processing | Streaming, typing |

```javascript
// Stream definition examples
{ name: 'MESSAGES', subjects: ['{prefix}.msg.>'], retention: 'file', max_age: '10m' }
{ name: 'REALTIME', subjects: ['{prefix}.realtime.>'], retention: 'memory', max_age: '1m' }
{ name: 'AI', subjects: ['{prefix}.ai.>'], retention: 'memory', max_age: '5m' }
{ name: 'DLQ', subjects: ['{prefix}.dlq.>'], retention: 'file', max_age: '30d' }
```

## Correlation ID

Generated at the system entry point and propagated through the entire chain:

```javascript
// Entry point (e.g., webhook handler)
const correlationId = req.headers['x-correlation-id'] || uuidv4();

// All downstream events preserve the same correlationId
await publishEvent('flow-events', {
  type: 'flow:execute',
  data: { flowId, context },
  correlationId: incomingEvent.correlationId,  // Preserved from upstream
  source: '{service-name}',
  timestamp: new Date().toISOString(),
});
```

## Subscribing to Events

```javascript
import { subscribe } from 'piece/pubsub';

await subscribe('MESSAGES', 'msg-orchestrator', async (event) => {
  logger.info('Message received', { correlationId: event.correlationId });
  await processInboundMessage(event.data);
}, {
  filterSubject: '{prefix}.msg.inbound.>',
});
```

## Dead Letter Queues (DLQ)

Failed messages are published to DLQ subjects:

```javascript
import { publishToDlq } from 'piece/pubsub';

try {
  await processMessage(event);
} catch (error) {
  await publishToDlq('msg', event, {
    error: error.message,
    failedAt: new Date().toISOString(),
    retryCount: event._retryCount || 0,
  });
}
```

**Publish only, NO subscriptions on DLQ subjects.** DLQ messages are for debugging and manual retry.

## WebSocket Events

Same structure as NATS events, delivered via WebSocket namespace `/events`:

```javascript
// Rooms for targeted delivery
`team:${teamId}`         // All users in a team
`user:${userId}`         // Specific user
`session:${sessionId}`   // AI session observers
```

## Anti-patterns

- **NEVER** publish events without `correlationId`, `source`, and `timestamp`
- **NEVER** skip event validation -- always use `piece/validation`
- **NEVER** subscribe to DLQ subjects -- they are for manual inspection only
- **NEVER** create ad-hoc event structures -- use event factory functions
- **NEVER** publish raw objects -- always go through `publishEvent()`
