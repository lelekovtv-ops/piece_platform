/**
 * NATS JetStream stream definitions.
 *
 * Each stream groups related subjects and defines retention policy.
 * Streams are automatically created/updated during initializePubSub().
 *
 * Placeholder tokens:
 *   koza-studio  — subject prefix, e.g. "myapp"
 */

export const StorageType = Object.freeze({
  FILE: 'file',
  MEMORY: 'memory',
});

/**
 * Stream definitions — add new streams here as your service inventory grows.
 *
 * @type {Array<{
 *   name: string,
 *   subjects: string[],
 *   storage: string,
 *   retention: string,
 *   max_age: number,
 *   description: string,
 * }>}
 */
export const STREAM_DEFINITIONS = [
  {
    name: 'MESSAGES',
    subjects: ['koza-studio.msg.>'],
    storage: StorageType.FILE,
    retention: 'limits',
    max_age: 24 * 60 * 60 * 1_000_000_000, // 24h in nanoseconds
    description: 'Inbound/outbound messaging events',
  },
  {
    name: 'NOTIFICATIONS',
    subjects: ['koza-studio.notifications.>'],
    storage: StorageType.FILE,
    retention: 'limits',
    max_age: 7 * 24 * 60 * 60 * 1_000_000_000, // 7d
    description: 'Email and push notification events',
  },
  {
    name: 'BILLING',
    subjects: ['koza-studio.billing.>'],
    storage: StorageType.FILE,
    retention: 'limits',
    max_age: 7 * 24 * 60 * 60 * 1_000_000_000, // 7d
    description: 'Billing usage deductions and balance events',
  },
  {
    name: 'INTEGRATIONS',
    subjects: ['koza-studio.integrations.>'],
    storage: StorageType.FILE,
    retention: 'limits',
    max_age: 24 * 60 * 60 * 1_000_000_000, // 24h
    description: 'Integration lifecycle events',
  },
  {
    name: 'KNOWLEDGE',
    subjects: ['koza-studio.knowledge.>'],
    storage: StorageType.FILE,
    retention: 'limits',
    max_age: 24 * 60 * 60 * 1_000_000_000, // 24h
    description: 'Knowledge base CRUD and embedding events',
  },
  {
    name: 'REALTIME',
    subjects: ['koza-studio.realtime.>'],
    storage: StorageType.MEMORY,
    retention: 'limits',
    max_age: 60 * 1_000_000_000, // 1 min
    description: 'Ephemeral real-time events (typing indicators)',
  },
  {
    name: 'EVENTS',
    subjects: ['koza-studio.events.>'],
    storage: StorageType.FILE,
    retention: 'limits',
    max_age: 24 * 60 * 60 * 1_000_000_000, // 24h
    description: 'Event notification dispatch',
  },
  {
    name: 'TABLES',
    subjects: ['koza-studio.tables.>'],
    storage: StorageType.FILE,
    retention: 'limits',
    max_age: 10 * 60 * 1_000_000_000, // 10 min
    description: 'Table and record CRUD events',
  },
  {
    name: 'DLQ',
    subjects: ['koza-studio.dlq.>'],
    storage: StorageType.FILE,
    retention: 'limits',
    max_age: 30 * 24 * 60 * 60 * 1_000_000_000, // 30d
    description: 'Dead letter queue — manual inspection only',
  },
];
