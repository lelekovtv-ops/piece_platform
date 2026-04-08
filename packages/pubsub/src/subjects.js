/**
 * NATS subject pattern builders.
 *
 * Subject format: koza-studio.{domain}.{action}.{key}
 *
 * Placeholder tokens:
 *   koza-studio  — subject namespace, e.g. "myapp"
 */

const PREFIX = 'koza-studio';

export const subjects = Object.freeze({
  // -----------------------------------------------------------------------
  // Messaging
  // -----------------------------------------------------------------------
  messageInbound: (chatId) => `${PREFIX}.msg.inbound.${chatId}`,
  messageOutbound: (chatId) => `${PREFIX}.msg.outbound.${chatId}`,
  messageEvents: (teamId) => `${PREFIX}.msg.events.${teamId}`,

  // -----------------------------------------------------------------------
  // Notifications
  // -----------------------------------------------------------------------
  notificationEmail: () => `${PREFIX}.notifications.email`,
  eventNotifications: (teamId) => `${PREFIX}.events.notifications.${teamId}`,

  // -----------------------------------------------------------------------
  // Billing
  // -----------------------------------------------------------------------
  billingEvents: (teamId) => `${PREFIX}.billing.events.${teamId}`,

  // -----------------------------------------------------------------------
  // Integrations
  // -----------------------------------------------------------------------
  integrationEvents: (teamId) => `${PREFIX}.integrations.events.${teamId}`,

  // -----------------------------------------------------------------------
  // Knowledge
  // -----------------------------------------------------------------------
  knowledgeEvents: (teamId) => `${PREFIX}.knowledge.events.${teamId}`,

  // -----------------------------------------------------------------------
  // Tables
  // -----------------------------------------------------------------------
  tableEvents: (teamId) => `${PREFIX}.tables.events.${teamId}`,

  // -----------------------------------------------------------------------
  // Realtime
  // -----------------------------------------------------------------------
  typing: (chatId) => `${PREFIX}.realtime.typing.${chatId}`,

  // -----------------------------------------------------------------------
  // Dead letter queue
  // -----------------------------------------------------------------------
  dlq: (domain) => `${PREFIX}.dlq.${domain}`,
});
