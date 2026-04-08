/**
 * piece/pubsub — NATS JetStream messaging.
 *
 * Provides publish/subscribe primitives over NATS JetStream with
 * automatic stream provisioning, pull-based consumers, and dead letter queue.
 *
 * Placeholder tokens:
 *   piece     — npm scope
 *   piece  — project slug
 *   piece        — subject prefix
 */

import { connect, AckPolicy, DeliverPolicy, StringCodec } from 'nats';
import { STREAM_DEFINITIONS } from './streams.js';
export { subjects } from './subjects.js';
export { STREAM_DEFINITIONS } from './streams.js';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let _natsConnection = null;
let _jetStreamClient = null;
let _jetStreamManager = null;
let _serviceName = 'unknown';
let _subjectPrefix = 'piece';

const sc = StringCodec();

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Connect to NATS and ensure all JetStream streams exist.
 *
 * @param {object} config — ServiceConfig instance (must expose `get('NATS_URL')`)
 * @param {{ serviceName: string, subjectPrefix?: string }} options
 */
export async function initializePubSub(config, { serviceName, subjectPrefix }) {
  _serviceName = serviceName;

  if (subjectPrefix) {
    _subjectPrefix = subjectPrefix;
  }

  const natsUrl = typeof config.get === 'function'
    ? config.get('NATS_URL')
    : 'nats://localhost:4222';

  _natsConnection = await connect({
    servers: natsUrl,
    name: serviceName,
    reconnect: true,
    maxReconnectAttempts: -1,
    reconnectTimeWait: 2000,
  });

  _jetStreamClient = _natsConnection.jetstream();
  _jetStreamManager = await _natsConnection.jetstreamManager();

  // Ensure streams exist
  for (const def of STREAM_DEFINITIONS) {
    try {
      await _jetStreamManager.streams.info(def.name);
      // Stream exists — update subjects if changed
      await _jetStreamManager.streams.update(def.name, {
        subjects: def.subjects,
        storage: def.storage === 'memory' ? 1 : 0, // nats.js: 0 = file, 1 = memory
        max_age: def.max_age,
      });
    } catch {
      // Stream does not exist — create
      await _jetStreamManager.streams.add({
        name: def.name,
        subjects: def.subjects,
        storage: def.storage === 'memory' ? 1 : 0,
        retention: 0, // limits
        max_age: def.max_age,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

/**
 * Publish a validated event to a JetStream subject.
 *
 * @param {string} subject — NATS subject (use `subjects.*` builders)
 * @param {object} event   — event object (must pass validateEvent)
 * @returns {Promise<number>} sequence number assigned by JetStream
 */
export async function publishEvent(subject, event) {
  if (!_jetStreamClient) {
    throw new Error('PubSub not initialised — call initializePubSub() first');
  }

  const payload = sc.encode(JSON.stringify(event));
  const ack = await _jetStreamClient.publish(subject, payload);
  return ack.seq;
}

/**
 * Publish a failed event to the dead letter queue for manual inspection.
 *
 * @param {string} domain   — domain identifier (e.g. 'msg', 'billing')
 * @param {object} event    — original event that failed
 * @param {object} metadata — failure context (error, failedAt, retryCount)
 */
export async function publishToDlq(domain, event, metadata) {
  const dlqEvent = {
    type: 'dlq:failed',
    data: {
      originalEvent: event,
      ...metadata,
    },
    correlationId: event.correlationId ?? 'unknown',
    source: _serviceName,
    timestamp: new Date().toISOString(),
  };

  const subject = `${_subjectPrefix}.dlq.${domain}`;
  const payload = sc.encode(JSON.stringify(dlqEvent));
  await _jetStreamClient.publish(subject, payload);
}

// ---------------------------------------------------------------------------
// Subscribe (pull-based consumer)
// ---------------------------------------------------------------------------

/**
 * Create a pull-based durable consumer on a JetStream stream.
 *
 * @param {string}   streamName   — stream name (e.g. 'MESSAGES')
 * @param {string}   consumerName — durable consumer name (unique per subscriber)
 * @param {Function} handler      — async (event) => void
 * @param {object}   [options]
 * @param {string}   [options.filterSubject] — subject filter (e.g. 'piece.msg.inbound.>')
 * @param {number}   [options.batchSize]     — messages per pull (default 10)
 * @param {number}   [options.maxWaitMs]     — max wait per pull (default 5000)
 * @returns {Promise<{ stop: Function }>}
 */
export async function subscribe(streamName, consumerName, handler, options = {}) {
  if (!_jetStreamClient || !_jetStreamManager) {
    throw new Error('PubSub not initialised — call initializePubSub() first');
  }

  const { filterSubject, batchSize = 10, maxWaitMs = 5000 } = options;

  // Ensure consumer exists
  const consumerConfig = {
    durable_name: consumerName,
    ack_policy: AckPolicy.Explicit,
    deliver_policy: DeliverPolicy.New,
    ...(filterSubject ? { filter_subject: filterSubject } : {}),
  };

  try {
    await _jetStreamManager.consumers.info(streamName, consumerName);
  } catch {
    await _jetStreamManager.consumers.add(streamName, consumerConfig);
  }

  const consumer = await _jetStreamClient.consumers.get(streamName, consumerName);

  let running = true;

  // Pull loop
  const pullLoop = async () => {
    while (running) {
      try {
        const messages = await consumer.fetch({
          max_messages: batchSize,
          expires: maxWaitMs,
        });

        for await (const msg of messages) {
          try {
            const event = JSON.parse(sc.decode(msg.data));
            await handler(event);
            msg.ack();
          } catch (err) {
            // Handler error — negative ack for redelivery
            msg.nak();
          }
        }
      } catch {
        // Connection lost — wait before retrying
        if (running) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  };

  // Start pull loop without awaiting (background)
  const loopPromise = pullLoop();

  return {
    stop() {
      running = false;
      return loopPromise;
    },
  };
}

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

/**
 * Get the underlying NATS connection.
 * Returns null if not yet initialised.
 */
export function getNatsClient() {
  return _natsConnection;
}
