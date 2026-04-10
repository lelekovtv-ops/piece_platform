import { subscribe } from "@piece/pubsub";
import { createComponentLogger } from "../utils/logger.js";

const subscriberLogger = createComponentLogger("ExampleSubscriber");

/**
 * Example NATS -> WebSocket subscriber.
 * Subscribes to a stream and broadcasts events to the team room.
 *
 * @param {import('socket.io').Namespace} io - Socket.IO /events namespace
 */
export async function initializeExampleSubscriber(io) {
  await subscribe(
    "EXAMPLE_STREAM",
    "ws-example",
    async (event) => {
      const { teamId } = event.data;
      if (!teamId) {
        subscriberLogger.warn("Event missing teamId", { type: event.type });
        return;
      }

      subscriberLogger.debug("Broadcasting event", {
        type: event.type,
        teamId,
      });

      io.to(`team:${teamId}`).emit(event.type, {
        type: event.type,
        data: event.data,
        timestamp: event.timestamp,
      });
    },
    {
      filterSubject: "piece.example.events.>",
    },
  );

  subscriberLogger.info("Example subscriber initialized");
}
