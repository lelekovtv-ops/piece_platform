import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@piece/multitenancy', () => {
  const mockCollection = {
    findOne: vi.fn(),
    insertOne: vi.fn().mockResolvedValue({ insertedId: 'mock-id' }),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  return {
    getGlobalSystemCollection: vi.fn(() => mockCollection),
    _mockCollection: mockCollection,
  };
});

vi.mock('@piece/validation/mongo', () => ({
  mongoIdUtils: {
    toObjectId: vi.fn((id) => id),
    toApiString: vi.fn((id) => id?.toString?.() ?? id),
    isValid: vi.fn(() => true),
  },
}));

vi.mock('@piece/validation/email', () => ({
  validateEmailDomain: vi.fn(),
  validateMxRecord: vi.fn().mockResolvedValue(true),
}));

const mockRedis = {
  pipeline: vi.fn(() => ({
    zadd: vi.fn().mockReturnThis(),
    zremrangebyscore: vi.fn().mockReturnThis(),
    zrangebyscore: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([[null, 0], [null, 1], [null, []], [null, 1]]),
  })),
  del: vi.fn().mockResolvedValue(1),
};

vi.mock('@piece/cache', () => ({
  getRedisClient: vi.fn(() => mockRedis),
  createCache: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  })),
  StandardTTL: { SHORT: 60, MEDIUM: 300, LONG: 3600 },
}));

const mockLockout = {
  isLocked: vi.fn().mockResolvedValue({ locked: false, attemptsLeft: 5, ttl: 0 }),
  recordFailedAttempt: vi.fn().mockResolvedValue({ locked: false, attempts: 1, attemptsLeft: 4 }),
  resetAttempts: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@piece/cache/accountLockout', () => ({
  createAccountLockout: vi.fn(() => mockLockout),
}));

vi.mock('@piece/cache/resendLimiter', () => ({
  createResendLimiter: vi.fn(() => ({
    canResend: vi.fn().mockResolvedValue({ allowed: true }),
    recordResend: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../../utils/logger.js', () => ({
  createComponentLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const defaults = {
        JWT_PRIVATE_KEY_BASE64: Buffer.from('test-private-key').toString('base64'),
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_REFRESH_EXPIRES_IN: '30d',
        NODE_ENV: 'test',
      };
      return defaults[key] ?? '';
    }),
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$12$hashedpassword'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn().mockReturnValue('mock.jwt.token'),
    verify: vi.fn().mockReturnValue({ sub: 'user-id', type: 'refresh' }),
  },
}));

const { authController } = await import('../controller.js');

function createMockReqRes(body = {}) {
  const req = { body, headers: {}, user: null };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return { req, res };
}

describe('Auth Controller — Account Lockout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLockout.isLocked.mockResolvedValue({ locked: false, attemptsLeft: 5, ttl: 0 });
  });

  it('should check lockout status before login attempt', async () => {
    const { req, res } = createMockReqRes({ email: 'test@example.com', password: 'password123' });

    await authController.login(req, res);

    expect(mockLockout.isLocked).toHaveBeenCalledWith('test@example.com');
  });

  it('should return 429 when account is locked', async () => {
    mockLockout.isLocked.mockResolvedValue({ locked: true, attemptsLeft: 0, ttl: 600 });

    const { req, res } = createMockReqRes({ email: 'locked@example.com', password: 'password123' });

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'ACCOUNT_LOCKED',
      }),
    );
  });

  it('should record failed attempt on wrong password', async () => {
    const { _mockCollection: mockCollection } = await import('@piece/multitenancy');
    const bcrypt = (await import('bcrypt')).default;

    mockCollection.findOne.mockResolvedValue({
      _id: 'user-1',
      email: 'test@example.com',
      passwordHash: '$2b$12$hash',
    });
    bcrypt.compare.mockResolvedValueOnce(false);

    const { req, res } = createMockReqRes({ email: 'test@example.com', password: 'wrongpassword' });

    await authController.login(req, res);

    expect(mockLockout.recordFailedAttempt).toHaveBeenCalledWith('test@example.com');
  });

  it('should reset attempts on successful login', async () => {
    const { _mockCollection: mockCollection } = await import('@piece/multitenancy');

    mockCollection.findOne.mockResolvedValue({
      _id: 'user-1',
      email: 'test@example.com',
      passwordHash: '$2b$12$hash',
    });
    mockCollection.insertOne.mockResolvedValue({ insertedId: 'token-1' });

    const { req, res } = createMockReqRes({ email: 'test@example.com', password: 'correctpassword' });

    await authController.login(req, res);

    expect(mockLockout.resetAttempts).toHaveBeenCalledWith('test@example.com');
  });
});
