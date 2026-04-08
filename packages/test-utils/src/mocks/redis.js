/**
 * vi.mock preset for piece/cache.
 *
 * Usage:
 *   import '@piece/test-utils/mocks/redis';
 */

import { vi } from 'vitest';

const store = new Map();

export const mockCache = {
  get: vi.fn(async (key) => {
    const val = store.get(key);
    return val !== undefined ? val : null;
  }),
  set: vi.fn(async (key, value) => {
    store.set(key, value);
  }),
  del: vi.fn(async (key) => {
    store.delete(key);
  }),
  exists: vi.fn(async (key) => store.has(key)),
  mget: vi.fn(async (keys) => {
    const result = new Map();
    for (const k of keys) {
      if (store.has(k)) result.set(k, store.get(k));
    }
    return result;
  }),
  deletePattern: vi.fn(async () => 0),
  acquireLock: vi.fn(async () => true),
  releaseLock: vi.fn(async () => undefined),
};

vi.mock('@piece/cache', () => ({
  initializeServiceCache: vi.fn().mockResolvedValue(mockCache),
  createCache: vi.fn(() => mockCache),
  getRedisClient: vi.fn(() => null),
  StandardTTL: {
    SHORT: 60,
    MEDIUM: 300,
    LONG: 3600,
    chatListShort: 300,
    chatMembersShort: 600,
    verification: 900,
    channel: 86400,
    chat: 1800,
    topic: 3600,
    topicLookup: 3600,
    secretApproval: 120,
    authSession: 600,
    aiEngineSession: 300,
    tableData: 1800,
    tableConfig: 3600,
    mediaFile: 86400,
    permissions: 600,
    user: 86400,
    userRoles: 86400,
  },
  CacheManager: vi.fn().mockReturnValue(mockCache),
}));

/**
 * Reset the in-memory store between tests.
 */
export function resetMockCache() {
  store.clear();
  mockCache.get.mockClear();
  mockCache.set.mockClear();
  mockCache.del.mockClear();
  mockCache.exists.mockClear();
}
