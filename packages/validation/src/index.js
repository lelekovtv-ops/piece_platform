/**
 * piece/validation — Event validation, MongoDB ID utils, event factories.
 *
 * Placeholder tokens:
 *   piece     — npm scope
 *   piece  — project slug
 *   piece        — subject prefix
 */

export { mongoIdUtils } from './mongo.js';

export {
  BaseEventSchema,
  validateEvent,
  safeValidateEvent,
  createEventFactory,
  MessageEvents,
  NotificationEvents,
  BillingEvents,
  IntegrationEvents,
  KnowledgeEvents,
  TableEvents,
  SecretEvents,
  TaskEvents,
} from './events/index.js';
