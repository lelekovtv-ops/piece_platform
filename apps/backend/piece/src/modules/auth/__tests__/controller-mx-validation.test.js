import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@piece/multitenancy', () => {
  const mockCollection = {
    findOne: vi.fn(),
    insertOne: vi.fn(),
    deleteOne: vi.fn(),
    deleteMany: vi.fn(),
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

const mockValidateMxRecord = vi.fn().mockResolvedValue(true);

vi.mock('@piece/validation/email', () => ({
  validateEmailDomain: vi.fn(),
  validateMxRecord: mockValidateMxRecord,
}));

vi.mock('@piece/cache', () => ({
  getRedisClient: vi.fn(() => ({})),
  createCache: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  })),
  StandardTTL: { SHORT: 60, MEDIUM: 300, LONG: 3600 },
}));

vi.mock('@piece/cache/accountLockout', () => ({
  createAccountLockout: vi.fn(() => ({
    isLocked: vi.fn().mockResolvedValue({ locked: false }),
    recordFailedAttempt: vi.fn(),
    resetAttempts: vi.fn(),
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

describe('Auth Controller — MX Record Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateMxRecord.mockResolvedValue(true);
  });

  it('should call validateMxRecord during registration', async () => {
    const { _mockCollection: mockCollection } = await import('@piece/multitenancy');
    mockCollection.findOne.mockResolvedValue(null);
    mockCollection.insertOne.mockResolvedValue({ insertedId: 'user-1' });

    const { req, res } = createMockReqRes({
      email: 'user@valid-domain.com',
      password: 'password123',
      name: 'Test User',
    });

    await authController.register(req, res);

    expect(mockValidateMxRecord).toHaveBeenCalledWith('user@valid-domain.com');
  });

  it('should reject registration when MX validation fails', async () => {
    mockValidateMxRecord.mockResolvedValue(false);

    const { req, res } = createMockReqRes({
      email: 'user@no-mx-domain.com',
      password: 'password123',
      name: 'Test User',
    });

    await authController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'INVALID_EMAIL_DOMAIN',
      }),
    );
  });

  it('should allow registration when MX validation returns true (DNS fail-open)', async () => {
    mockValidateMxRecord.mockResolvedValue(true);
    const { _mockCollection: mockCollection } = await import('@piece/multitenancy');
    mockCollection.findOne.mockResolvedValue(null);
    mockCollection.insertOne.mockResolvedValue({ insertedId: 'user-1' });

    const { req, res } = createMockReqRes({
      email: 'user@good-domain.com',
      password: 'password123',
      name: 'Test User',
    });

    await authController.register(req, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
  });
});
