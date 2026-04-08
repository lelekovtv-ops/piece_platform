/**
 * vi.mock preset for piece/logger.
 *
 * Usage:
 *   import '@piece/test-utils/mocks/logger';
 */

import { vi } from 'vitest';

const mockComponentLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

export const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  createComponentLogger: vi.fn(() => ({ ...mockComponentLogger })),
};

vi.mock('@piece/logger', () => ({
  createLogger: vi.fn(() => ({ ...mockLogger })),
  createRequestLoggingMiddleware: vi.fn(() => (_req, _res, next) => next()),
  runWithContext: vi.fn((ctx, fn) => fn()),
  getCorrelationId: vi.fn(() => 'test-correlation-id'),
  asyncLocalStorage: { getStore: vi.fn(() => ({})) },
}));

export { mockComponentLogger };
