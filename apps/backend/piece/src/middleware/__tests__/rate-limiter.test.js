import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@piece/cache', () => {
  const mockCache = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
  };
  return {
    createCache: vi.fn(() => mockCache),
    StandardTTL: { SHORT: 60, MEDIUM: 300, LONG: 3600 },
    _mockCache: mockCache,
  };
});

vi.mock('../../../utils/logger.js', () => ({
  createComponentLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

const { _mockCache: mockCache } = await import('@piece/cache');
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
  });

  it('should allow requests under the limit', async () => {
    mockCache.get.mockResolvedValue(5);
    mockCache.set.mockResolvedValue(undefined);

    const limiter = createRateLimiter({ maxRequests: 10, windowSeconds: 60 });
    const { req, res, next } = createMockReqRes();

    await limiter(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should block requests over the limit with 429', async () => {
    mockCache.get.mockResolvedValue(11);

    const limiter = createRateLimiter({ maxRequests: 10, windowSeconds: 60 });
    const { req, res, next } = createMockReqRes();

    await limiter(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'RATE_LIMIT_EXCEEDED',
        message: expect.any(String),
      }),
    );
  });

  it('should initialize counter on first request', async () => {
    mockCache.get.mockResolvedValue(null);

    const limiter = createRateLimiter({ maxRequests: 10, windowSeconds: 60 });
    const { req, res, next } = createMockReqRes();

    await limiter(req, res, next);

    expect(mockCache.set).toHaveBeenCalledWith(
      expect.stringContaining('127.0.0.1'),
      1,
      60,
    );
    expect(next).toHaveBeenCalled();
  });

  it('should increment counter on subsequent requests', async () => {
    mockCache.get.mockResolvedValue(3);

    const limiter = createRateLimiter({ maxRequests: 10, windowSeconds: 60 });
    const { req, res, next } = createMockReqRes();

    await limiter(req, res, next);

    expect(mockCache.set).toHaveBeenCalledWith(
      expect.stringContaining('127.0.0.1'),
      4,
      60,
    );
    expect(next).toHaveBeenCalled();
  });

  it('should use IP + path as key for per-endpoint limiting', async () => {
    mockCache.get.mockResolvedValue(null);

    const limiter = createRateLimiter({ maxRequests: 10, windowSeconds: 60 });
    const { req, res, next } = createMockReqRes('10.0.0.1', '/v1/auth/login');

    await limiter(req, res, next);

    expect(mockCache.set).toHaveBeenCalledWith(
      expect.stringContaining('10.0.0.1:/v1/auth/login'),
      1,
      60,
    );
  });

  it('should set Retry-After header on 429 response', async () => {
    mockCache.get.mockResolvedValue(11);

    const limiter = createRateLimiter({ maxRequests: 10, windowSeconds: 60 });
    const { req, res, next } = createMockReqRes();

    await limiter(req, res, next);

    expect(res.set).toHaveBeenCalledWith('Retry-After', '60');
  });

  it('should gracefully pass through if cache is unavailable', async () => {
    mockCache.get.mockRejectedValue(new Error('Redis down'));

    const limiter = createRateLimiter({ maxRequests: 10, windowSeconds: 60 });
    const { req, res, next } = createMockReqRes();

    await limiter(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
