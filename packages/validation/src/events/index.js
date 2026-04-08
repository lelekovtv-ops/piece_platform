/**
 * Event validation and factory system.
 *
 * Every inter-service event MUST be created via a factory and validated
 * before publishing to NATS JetStream.
 *
 * Placeholder tokens:
 *   piece     — npm scope
 *   koza-studio  — project slug
 *   koza-studio        — subject prefix
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Base event schema
// ---------------------------------------------------------------------------

export const BaseEventSchema = z.object({
  type: z.string().min(1),
  data: z.record(z.unknown()),
  correlationId: z.string().uuid(),
  source: z.string().min(1),
  timestamp: z.string().datetime(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional().default('normal'),
});

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate an event object. Throws a descriptive error on failure.
 *
 * @param {object} event
 * @throws {Error} with structured validation details
 */
export function validateEvent(event) {
  const result = BaseEventSchema.safeParse(event);
  if (!result.success) {
    const details = result.error.issues.map(
      (i) => `${i.path.join('.')}: ${i.message}`,
    );
    const err = new Error(`Event validation failed: ${details.join('; ')}`);
    err.details = details;
    throw err;
  }
}

/**
 * Validate an event without throwing.
 *
 * @param {object} event
 * @returns {{ valid: boolean, errors: string[] | null, data: object | null }}
 */
export function safeValidateEvent(event) {
  const result = BaseEventSchema.safeParse(event);
  if (result.success) {
    return { valid: true, errors: null, data: result.data };
  }
  return {
    valid: false,
    errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    data: null,
  };
}

// ---------------------------------------------------------------------------
// Event factory builder
// ---------------------------------------------------------------------------

/**
 * Create a domain-specific event factory.
 *
 * Usage:
 *   const ItemEvents = createEventFactory('items');
 *   const event = ItemEvents.created({ id: '1', name: 'Widget' }, 'items-service', correlationId);
 *
 * Each factory method returns a fully-formed event object ready for
 * `publishEvent()`. The event type follows the pattern `localhost:{action}`.
 *
 * @param {string} domain — domain prefix for event types (e.g. 'items', 'billing')
 * @returns {object} factory with common CRUD event builders
 */
export function createEventFactory(domain) {
  function buildEvent(action, data, source, correlationId, priority) {
    return {
      type: `$localhost:${action}`,
      data: data ?? {},
      correlationId,
      source,
      timestamp: new Date().toISOString(),
      ...(priority ? { priority } : {}),
    };
  }

  return {
    /** Generic builder for custom event actions */
    event(action, data, source, correlationId, priority) {
      return buildEvent(action, data, source, correlationId, priority);
    },

    created(data, source, correlationId) {
      return buildEvent('created', data, source, correlationId);
    },

    updated(data, source, correlationId) {
      return buildEvent('updated', data, source, correlationId);
    },

    deleted(data, source, correlationId) {
      return buildEvent('deleted', data, source, correlationId);
    },
  };
}

// ---------------------------------------------------------------------------
// Built-in event factories (extend as your project grows)
// ---------------------------------------------------------------------------

export const MessageEvents = {
  inbound(data, source, correlationId) {
    return {
      type: 'message:inbound',
      data,
      correlationId,
      source,
      timestamp: new Date().toISOString(),
    };
  },

  outbound(data, source, correlationId) {
    return {
      type: 'message:outbound',
      data,
      correlationId,
      source,
      timestamp: new Date().toISOString(),
    };
  },
};

export const NotificationEvents = {
  email(data, source, correlationId) {
    return {
      type: 'email:outbound',
      data,
      correlationId,
      source,
      timestamp: new Date().toISOString(),
    };
  },

  notification(data, source, correlationId) {
    return {
      type: 'event:notification',
      data,
      correlationId,
      source,
      timestamp: new Date().toISOString(),
    };
  },
};

export const BillingEvents = {
  deducted(data, source, correlationId) {
    return {
      type: 'billing:usage:deducted',
      data,
      correlationId,
      source,
      timestamp: new Date().toISOString(),
      priority: 'normal',
    };
  },

  balanceLow(data, source, correlationId) {
    return {
      type: 'billing:balance:low',
      data,
      correlationId,
      source,
      timestamp: new Date().toISOString(),
      priority: 'high',
    };
  },

  balanceZero(data, source, correlationId) {
    return {
      type: 'billing:balance:zero',
      data,
      correlationId,
      source,
      timestamp: new Date().toISOString(),
      priority: 'critical',
    };
  },

  topupCompleted(data, source, correlationId) {
    return {
      type: 'billing:topup:completed',
      data,
      correlationId,
      source,
      timestamp: new Date().toISOString(),
    };
  },
};

export const IntegrationEvents = createEventFactory('integration');
export const KnowledgeEvents = createEventFactory('knowledge');
export const TableEvents = createEventFactory('table');
export const SecretEvents = createEventFactory('secret');
export const TaskEvents = createEventFactory('task');
