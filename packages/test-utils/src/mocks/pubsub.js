/**
 * vi.mock preset for piece/pubsub.
 *
 * Usage:
 *   import '@piece/test-utils/mocks/pubsub';
 */

import { vi } from 'vitest';

export const mockPublishEvent = vi.fn().mockResolvedValue(1);
export const mockSubscribe = vi.fn().mockResolvedValue({ stop: vi.fn() });
export const mockPublishToDlq = vi.fn().mockResolvedValue(undefined);

vi.mock('@piece/pubsub', () => ({
  initializePubSub: vi.fn().mockResolvedValue(undefined),
  publishEvent: mockPublishEvent,
  subscribe: mockSubscribe,
  publishToDlq: mockPublishToDlq,
  getNatsClient: vi.fn(() => null),
  subjects: new Proxy(
    {},
    {
      get(_target, prop) {
        return (key) => `piece.${String(prop)}.${key ?? ''}`;
      },
    },
  ),
}));
