import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@piece/cache', () => ({
  getRedisClient: vi.fn(() => null),
  StandardTTL: { SHORT: 60, MEDIUM: 300, LONG: 3600 },
}));

vi.mock('../../../utils/logger.js', () => ({
  createComponentLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

const { getRedisClient } = await import('@piece/cache');
const { createRateLimiter } = await import('../rate-limiter.js');

function createMockReqRes(ip = '127.0.0.1', path = '/v1/auth/login') {
  const req = { ip, path, headers: {} };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('Rate Limiter Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRedisClient.mockReturnValue(null);
  });

  describe('memory fallback (no Redis)', () => {
    it('should allow requests under the limit', async () => {
      const limiter = createRateLimiter({ maxRequests: 10, windowSeconds: 60 });
      const { req, res, next } = createMockReqRes();

      await limiter(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block requests over the limit with 429', async () => {
      const limiter = createRateLimiter({ maxRequests: 3, windowSeconds: 60 });
      const { req, res, next } = createMockReqRes();

      await limiter(req, res, next);
      await limiter(req, res, next);
      await limiter(req, res, next);

      vi.clearAllMocks();
      await limiter(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'RATE_LIMIT_EXCEEDED',
        }),
      );
    });

    it('should set Retry-After header on 429 response', async () => {
      const limiter = createRateLimiter({ maxRequests: 1, windowSeconds: 30 });
      const { req, res, next } = createMockReqRes();

      await limiter(req, res, next);

      vi.clearAllMocks();
      await limiter(req, res, next);

      expect(res.set).toHaveBeenCalledWith('Retry-After', '30');
    });

    it('should use IP + path as key for per-endpoint limiting', async () => {
      const limiter = createRateLimiter({ maxRequests: 1, windowSeconds: 60 });
      const r1 = createMockReqRes('10.0.0.1', '/v1/auth/login');
      const r2 = createMockReqRes('10.0.0.2', '/v1/auth/login');

      await limiter(r1.req, r1.res, r1.next);
      await limiter(r2.req, r2.res, r2.next);

      expect(r1.next).toHaveBeenCalled();
      expect(r2.next).toHaveBeenCalled();
    });
  });

  describe('Redis sliding window', () => {
    it('should allow requests when Redis count is under limit', async () => {
      const mockPipeline = {
        zremrangebyscore: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 0],
          [null, 1],
          [null, 3],
          [null, 1],
        ]),
      };
      getRedisClient.mockReturnValue({ pipeline: () => mockPipeline });

      const limiter = createRateLimiter({ maxRequests: 10, windowSeconds: 60 });
      const { req, res, next } = createMockReqRes();

      await limiter(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block when Redis count exceeds limit', async () => {
      const mockPipeline = {
        zremrangebyscore: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 0],
          [null, 1],
          [null, 11],
          [null, 1],
        ]),
      };
      getRedisClient.mockReturnValue({ pipeline: () => mockPipeline });

      const limiter = createRateLimiter({ maxRequests: 10, windowSeconds: 60 });
      const { req, res, next } = createMockReqRes();

      await limiter(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should fall back to memory if Redis throws', async () => {
      const mockPipeline = {
        zremrangebyscore: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockRejectedValue(new Error('Redis down')),
      };
      getRedisClient.mockReturnValue({ pipeline: () => mockPipeline });

      const limiter = createRateLimiter({ maxRequests: 10, windowSeconds: 60 });
      const { req, res, next } = createMockReqRes();

      await limiter(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
