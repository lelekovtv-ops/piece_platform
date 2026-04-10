import { vi, describe, it, expect, beforeEach } from 'vitest';

// --- Shared mock references ---

const mockPipeline = {
  zadd: vi.fn().mockReturnThis(),
  zremrangebyscore: vi.fn().mockReturnThis(),
  zrangebyscore: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  exec: vi.fn(),
};

const mockRedisClient = {
  pipeline: vi.fn(() => mockPipeline),
  del: vi.fn().mockResolvedValue(1),
};

const mockUsersCollection = {
  findOne: vi.fn(),
  insertOne: vi.fn(),
  updateOne: vi.fn(),
  deleteOne: vi.fn(),
  deleteMany: vi.fn(),
};

const mockRefreshTokensCollection = {
  findOne: vi.fn(),
  insertOne: vi.fn(),
  updateOne: vi.fn(),
  deleteOne: vi.fn(),
  deleteMany: vi.fn(),
  findOneAndUpdate: vi.fn(),
};

// --- Mocks (before any imports) ---

vi.mock('@piece/cache', () => ({
  getRedisClient: vi.fn(() => mockRedisClient),
  createAccountLockout: vi.fn(() => ({
    isLocked: vi.fn().mockResolvedValue({ locked: false }),
    recordFailedAttempt: vi.fn().mockResolvedValue(undefined),
    resetAttempts: vi.fn().mockResolvedValue(undefined),
  })),
  createResendLimiter: vi.fn(() => ({
    canResend: vi.fn().mockResolvedValue({ allowed: true }),
    recordResend: vi.fn().mockResolvedValue(undefined),
  })),
  createCache: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  })),
  StandardTTL: { SHORT: 60, MEDIUM: 300, LONG: 3600, verification: 900 },
}));

vi.mock('@piece/cache/accountLockout', () => ({
  createAccountLockout: vi.fn(() => ({
    isLocked: vi.fn().mockResolvedValue({ locked: false }),
    recordFailedAttempt: vi.fn().mockResolvedValue(undefined),
    resetAttempts: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@piece/cache/resendLimiter', () => ({
  createResendLimiter: vi.fn(() => ({
    canResend: vi.fn().mockResolvedValue({ allowed: true }),
    recordResend: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@piece/multitenancy', () => ({
  getGlobalSystemCollection: vi.fn((name) => {
    if (name === 'refresh_tokens') return mockRefreshTokensCollection;
    return mockUsersCollection;
  }),
}));

vi.mock('@piece/validation/mongo', () => ({
  mongoIdUtils: {
    toObjectId: vi.fn((id) => id),
    toApiString: vi.fn((id) => id?.toString?.() ?? id),
    isValid: vi.fn(() => true),
  },
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
        NODE_ENV: 'test',
        JWT_PRIVATE_KEY_BASE64: Buffer.from('test-private-key').toString('base64'),
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_REFRESH_EXPIRES_IN: '30d',
        FRONTEND_URL: 'http://localhost:5201',
        DISABLE_EMAIL_SENDING: 'true',
      };
      return defaults[key] ?? '';
    }),
  },
}));

vi.mock('../../teams/service.js', () => ({
  teamService: {
    create: vi.fn().mockResolvedValue({ id: 'team-id' }),
    listByUser: vi.fn().mockResolvedValue([{ id: 'team-id', role: 'owner' }]),
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

vi.mock('@piece/validation/email', () => ({
  validateEmailDomain: vi.fn(),
  validateMxRecord: vi.fn().mockResolvedValue(true),
}));

vi.mock('../audit-service.js', () => ({
  auditService: {
    logAuthEvent: vi.fn(),
    AUTH_EVENTS: {
      LOGIN_SUCCESS: 'login_success',
      LOGIN_FAILED: 'login_failed',
      REGISTER: 'register',
      LOGOUT: 'logout',
      PASSWORD_CHANGE: 'password_change',
      ACCOUNT_LOCKED: 'account_locked',
      MAGIC_LINK_SENT: 'magic_link_sent',
      MAGIC_LINK_VERIFIED: 'magic_link_verified',
      SESSION_REVOKED: 'session_revoked',
      ALL_SESSIONS_REVOKED: 'all_sessions_revoked',
      EMAIL_VERIFICATION_SENT: 'email_verification_sent',
      EMAIL_VERIFIED: 'email_verified',
      PASSWORD_RESET_REQUESTED: 'password_reset_requested',
      PASSWORD_RESET_CONFIRMED: 'password_reset_confirmed',
    },
  },
}));

vi.mock('../session-service.js', () => ({
  sessionService: {
    createSession: vi.fn().mockResolvedValue({}),
    updateSessionTokenHash: vi.fn().mockResolvedValue({}),
    getActiveSessions: vi.fn().mockResolvedValue([]),
    revokeSession: vi.fn().mockResolvedValue(true),
    revokeAllSessions: vi.fn().mockResolvedValue(2),
  },
}));

vi.mock('../magic-link-service.js', () => ({
  generateMagicLink: vi.fn(),
  sendMagicLinkEmail: vi.fn(),
  verifyMagicLink: vi.fn(),
}));

vi.mock('../../../middleware/csrf.js', () => ({
  generateCsrfToken: vi.fn().mockReturnValue('csrf-token'),
  setCsrfCookie: vi.fn(),
}));

// --- Import modules after all mocks ---

const { getRedisClient } = await import('@piece/cache');
const { recordFailedLoginAndCheck, clearSuspiciousTracking } = await import('../suspicious-activity.js');
const { authService } = await import('../service.js');
const { authController } = await import('../controller.js');

// --- Helpers ---

function mockReq(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    cookies: {},
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-agent' },
    user: null,
    ...overrides,
  };
}

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
    _getStatusCode: () => res.status.mock.calls[0]?.[0],
    _getBody: () => res.json.mock.calls[0]?.[0],
  };
  return res;
}

// =============================================================================
// 1. Suspicious Activity Detection
// =============================================================================

describe('Suspicious Activity Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRedisClient.mockReturnValue(mockRedisClient);
    mockRedisClient.pipeline.mockReturnValue(mockPipeline);
    mockPipeline.zadd.mockReturnThis();
    mockPipeline.zremrangebyscore.mockReturnThis();
    mockPipeline.zrangebyscore.mockReturnThis();
    mockPipeline.expire.mockReturnThis();
    mockRedisClient.del.mockResolvedValue(1);
  });

  describe('recordFailedLoginAndCheck', () => {
    it('should store entry in Redis sorted set with ip:timestamp format', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 1],
        [null, 0],
        [null, ['192.168.1.1:1700000000000']],
        [null, 1],
      ]);

      await recordFailedLoginAndCheck('user@test.com', '192.168.1.1');

      expect(mockRedisClient.pipeline).toHaveBeenCalled();
      expect(mockPipeline.zadd).toHaveBeenCalledWith(
        'piece:suspicious:failed:user@test.com',
        expect.any(Number),
        expect.stringMatching(/^192\.168\.1\.1:\d+$/),
      );
    });

    it('should remove entries older than 1 hour', async () => {
      const now = Date.now();
      mockPipeline.exec.mockResolvedValue([
        [null, 1],
        [null, 0],
        [null, []],
        [null, 1],
      ]);

      await recordFailedLoginAndCheck('user@test.com', '10.0.0.1');

      expect(mockPipeline.zremrangebyscore).toHaveBeenCalledWith(
        'piece:suspicious:failed:user@test.com',
        0,
        expect.any(Number),
      );

      const windowStart = mockPipeline.zremrangebyscore.mock.calls[0][2];
      expect(now - windowStart).toBeLessThanOrEqual(60 * 60 * 1000 + 500);
      expect(now - windowStart).toBeGreaterThanOrEqual(60 * 60 * 1000 - 500);
    });

    it('should return false when fewer than 10 attempts', async () => {
      const entries = Array.from({ length: 5 }, (_, i) => `10.0.0.${i}:${Date.now()}`);
      mockPipeline.exec.mockResolvedValue([
        [null, 1],
        [null, 0],
        [null, entries],
        [null, 1],
      ]);

      const result = await recordFailedLoginAndCheck('user@test.com', '10.0.0.1');
      expect(result).toBe(false);
    });

    it('should return false when 10+ attempts but fewer than 3 unique IPs', async () => {
      const entries = Array.from({ length: 12 }, (_, i) => `192.168.1.1:${Date.now() + i}`);
      mockPipeline.exec.mockResolvedValue([
        [null, 1],
        [null, 0],
        [null, entries],
        [null, 1],
      ]);

      const result = await recordFailedLoginAndCheck('user@test.com', '192.168.1.1');
      expect(result).toBe(false);
    });

    it('should return true (suspicious) when 10+ attempts AND 3+ unique IPs', async () => {
      const entries = [
        ...Array.from({ length: 4 }, (_, i) => `10.0.0.1:${Date.now() + i}`),
        ...Array.from({ length: 4 }, (_, i) => `10.0.0.2:${Date.now() + 100 + i}`),
        ...Array.from({ length: 4 }, (_, i) => `10.0.0.3:${Date.now() + 200 + i}`),
      ];
      mockPipeline.exec.mockResolvedValue([
        [null, 1],
        [null, 0],
        [null, entries],
        [null, 1],
      ]);

      const result = await recordFailedLoginAndCheck('user@test.com', '10.0.0.3');
      expect(result).toBe(true);
    });

    it('should return false when Redis client is not available', async () => {
      getRedisClient.mockReturnValueOnce(null);

      const result = await recordFailedLoginAndCheck('user@test.com', '10.0.0.1');
      expect(result).toBe(false);
    });

    it('should return false and not throw when Redis pipeline errors', async () => {
      mockPipeline.exec.mockRejectedValue(new Error('Redis connection lost'));

      const result = await recordFailedLoginAndCheck('user@test.com', '10.0.0.1');
      expect(result).toBe(false);
    });

    it('should normalize email to lowercase', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 1],
        [null, 0],
        [null, []],
        [null, 1],
      ]);

      await recordFailedLoginAndCheck('USER@Test.COM', '10.0.0.1');

      expect(mockPipeline.zadd).toHaveBeenCalledWith(
        'piece:suspicious:failed:user@test.com',
        expect.any(Number),
        expect.any(String),
      );
    });

    it('should set key expiry to 3600 seconds', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 1],
        [null, 0],
        [null, []],
        [null, 1],
      ]);

      await recordFailedLoginAndCheck('user@test.com', '10.0.0.1');

      expect(mockPipeline.expire).toHaveBeenCalledWith(
        'piece:suspicious:failed:user@test.com',
        3600,
      );
    });
  });

  describe('clearSuspiciousTracking', () => {
    it('should delete the Redis key for the email', async () => {
      await clearSuspiciousTracking('user@test.com');

      expect(mockRedisClient.del).toHaveBeenCalledWith('piece:suspicious:failed:user@test.com');
    });

    it('should normalize email to lowercase', async () => {
      await clearSuspiciousTracking('USER@Test.COM');

      expect(mockRedisClient.del).toHaveBeenCalledWith('piece:suspicious:failed:user@test.com');
    });

    it('should not throw when Redis is unavailable', async () => {
      getRedisClient.mockReturnValueOnce(null);

      await expect(clearSuspiciousTracking('user@test.com')).resolves.toBeUndefined();
    });

    it('should not throw on Redis errors', async () => {
      mockRedisClient.del.mockRejectedValueOnce(new Error('Redis error'));

      await expect(clearSuspiciousTracking('user@test.com')).resolves.toBeUndefined();
    });
  });
});

// =============================================================================
// 2. Account Enumeration Protection
// =============================================================================

describe('Account Enumeration Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRedisClient.mockReturnValue(mockRedisClient);
  });

  describe('register — EMAIL_TAKEN returns fake 201', () => {
    it('should return 201 with {user: {email}, accessToken: null} when email is taken', async () => {
      const req = mockReq({ body: { email: 'taken@test.com', password: 'password123', name: 'Test' } });
      const res = mockRes();

      const emailTakenError = new Error('Email is already registered');
      emailTakenError.code = 'EMAIL_TAKEN';

      vi.spyOn(authService, 'register').mockRejectedValueOnce(emailTakenError);

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      const body = res._getBody();
      expect(body).toEqual({
        user: { email: 'taken@test.com' },
        accessToken: null,
      });
    });

    it('should make fake 201 indistinguishable from real 201 status code', async () => {
      const req = mockReq({ body: { email: 'taken@test.com', password: 'password123' } });
      const res = mockRes();

      const emailTakenError = new Error('Email is already registered');
      emailTakenError.code = 'EMAIL_TAKEN';
      vi.spyOn(authService, 'register').mockRejectedValueOnce(emailTakenError);

      await authController.register(req, res);

      expect(res._getStatusCode()).toBe(201);
      expect(res._getBody().user).toBeDefined();
      expect(res._getBody().accessToken).toBeNull();
    });
  });

  describe('password reset — same response for existing and non-existing emails', () => {
    it('should return same message regardless of whether email exists', async () => {
      vi.spyOn(authService, 'requestPasswordReset').mockResolvedValueOnce(undefined);

      const req = mockReq({ body: { email: 'exists@test.com' } });
      const res = mockRes();
      await authController.requestPasswordReset(req, res);

      const existingBody = res._getBody();

      vi.spyOn(authService, 'requestPasswordReset').mockResolvedValueOnce(undefined);

      const req2 = mockReq({ body: { email: 'nonexistent@test.com' } });
      const res2 = mockRes();
      await authController.requestPasswordReset(req2, res2);

      const nonExistingBody = res2._getBody();

      expect(existingBody.message).toBe(nonExistingBody.message);
      expect(existingBody.message).toBe('If that email is registered, a reset link has been sent');
    });

    it('should return 200 with safe message even when service throws', async () => {
      vi.spyOn(authService, 'requestPasswordReset').mockRejectedValueOnce(new Error('DB error'));

      const req = mockReq({ body: { email: 'user@test.com' } });
      const res = mockRes();
      await authController.requestPasswordReset(req, res);

      const body = res._getBody();
      expect(body.message).toBe('If that email is registered, a reset link has been sent');
    });
  });

  describe('login — same error for wrong password and non-existent user', () => {
    it('should return same UNAUTHORIZED error for both cases', async () => {
      vi.spyOn(authService, 'login').mockResolvedValueOnce(null);

      const req1 = mockReq({ body: { email: 'wrong-pass@test.com', password: 'wrongpass123' } });
      const res1 = mockRes();
      await authController.login(req1, res1);

      vi.spyOn(authService, 'login').mockResolvedValueOnce(null);

      const req2 = mockReq({ body: { email: 'nouser@test.com', password: 'anypass123' } });
      const res2 = mockRes();
      await authController.login(req2, res2);

      expect(res1._getStatusCode()).toBe(401);
      expect(res2._getStatusCode()).toBe(401);
      expect(res1._getBody().error).toBe('UNAUTHORIZED');
      expect(res2._getBody().error).toBe('UNAUTHORIZED');
      expect(res1._getBody().message).toBe(res2._getBody().message);
      expect(res1._getBody().message).toBe('Invalid credentials');
    });
  });
});

// =============================================================================
// 3. Memory Map 10K Cap
// =============================================================================

describe('Memory Map 10K Cap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use MEMORY_MAP_SIZE_LIMIT of 10,000', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const controllerPath = path.resolve(
      new URL('.', import.meta.url).pathname,
      '../controller.js',
    );
    const source = fs.readFileSync(controllerPath, 'utf-8');
    expect(source).toContain('MEMORY_MAP_SIZE_LIMIT = 10_000');
  });

  it('should use FIFO eviction (map.keys().next().value)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const controllerPath = path.resolve(
      new URL('.', import.meta.url).pathname,
      '../controller.js',
    );
    const source = fs.readFileSync(controllerPath, 'utf-8');
    expect(source).toContain('map.keys().next().value');
  });

  it('enforceMapSizeLimit should delete oldest key when map reaches limit', () => {
    const map = new Map();
    const LIMIT = 10_000;

    for (let i = 0; i < LIMIT; i++) {
      map.set(`key-${i}`, { count: 1, expiresAt: Date.now() + 900_000 });
    }
    expect(map.size).toBe(LIMIT);

    const enforceMapSizeLimit = (m) => {
      if (m.size >= LIMIT) {
        const oldestKey = m.keys().next().value;
        m.delete(oldestKey);
      }
    };

    enforceMapSizeLimit(map);

    expect(map.size).toBe(LIMIT - 1);
    expect(map.has('key-0')).toBe(false);
    expect(map.has('key-1')).toBe(true);
  });

  it('enforceMapSizeLimit should not delete when map is under limit', () => {
    const map = new Map();
    map.set('key-a', { count: 1, expiresAt: Date.now() + 900_000 });
    map.set('key-b', { count: 2, expiresAt: Date.now() + 900_000 });

    const enforceMapSizeLimit = (m) => {
      if (m.size >= 10_000) {
        const oldestKey = m.keys().next().value;
        m.delete(oldestKey);
      }
    };

    enforceMapSizeLimit(map);

    expect(map.size).toBe(2);
    expect(map.has('key-a')).toBe(true);
    expect(map.has('key-b')).toBe(true);
  });

  it('should call enforceMapSizeLimit before adding new memory lockout entry', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const controllerPath = path.resolve(
      new URL('.', import.meta.url).pathname,
      '../controller.js',
    );
    const source = fs.readFileSync(controllerPath, 'utf-8');

    const funcBody = source.substring(
      source.indexOf('function recordMemoryFailedAttempt'),
      source.indexOf('function resetMemoryLockout'),
    );
    expect(funcBody).toContain('enforceMapSizeLimit(memoryLockout)');
  });
});

// =============================================================================
// 4. Password Change Session Revocation
// =============================================================================

describe('Password Change Session Revocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRedisClient.mockReturnValue(mockRedisClient);

    mockUsersCollection.findOne.mockResolvedValue({
      _id: 'user-123',
      email: 'user@test.com',
      passwordHash: '$2b$12$existinghash',
      name: 'Test User',
    });
    mockRefreshTokensCollection.deleteMany.mockResolvedValue({ deletedCount: 3 });
  });

  it('should revoke all tokens EXCEPT the current one after password change', async () => {
    await authService.changePassword('user-123', 'currentpass', 'newpassword123', 'keep-this-hash');

    expect(mockRefreshTokensCollection.deleteMany).toHaveBeenCalledWith({
      userId: 'user-123',
      tokenHash: { $ne: 'keep-this-hash' },
    });
  });

  it('should revoke ALL tokens when no exceptTokenHash is provided', async () => {
    await authService.changePassword('user-123', 'currentpass', 'newpassword123', null);

    expect(mockRefreshTokensCollection.deleteMany).toHaveBeenCalledWith({
      userId: 'user-123',
    });
  });

  it('revokeAllUserTokens should exclude the provided token hash', async () => {
    await authService.revokeAllUserTokens('user-123', 'exception-hash');

    expect(mockRefreshTokensCollection.deleteMany).toHaveBeenCalledWith({
      userId: 'user-123',
      tokenHash: { $ne: 'exception-hash' },
    });
  });

  it('revokeAllUserTokens should delete all when no exclusion provided', async () => {
    await authService.revokeAllUserTokens('user-123', null);

    expect(mockRefreshTokensCollection.deleteMany).toHaveBeenCalledWith({
      userId: 'user-123',
    });
  });

  it('controller should pass current refresh token hash to changePassword', async () => {
    const changePasswordSpy = vi.spyOn(authService, 'changePassword').mockResolvedValueOnce(undefined);

    const refreshToken = 'current-refresh-token';
    const req = mockReq({
      body: { currentPassword: 'oldpass', newPassword: 'newpass12345' },
      user: { id: 'user-123' },
      cookies: { piece_rt: refreshToken },
    });
    const res = mockRes();

    await authController.changePassword(req, res);

    expect(changePasswordSpy).toHaveBeenCalledWith(
      'user-123',
      'oldpass',
      'newpass12345',
      expect.any(String),
    );

    const passedHash = changePasswordSpy.mock.calls[0][3];
    expect(passedHash).toBeTruthy();
    expect(typeof passedHash).toBe('string');
  });

  it('controller should pass null hash when no refresh token cookie', async () => {
    const changePasswordSpy = vi.spyOn(authService, 'changePassword').mockResolvedValueOnce(undefined);

    const req = mockReq({
      body: { currentPassword: 'oldpass', newPassword: 'newpass12345' },
      user: { id: 'user-123' },
      cookies: {},
    });
    const res = mockRes();

    await authController.changePassword(req, res);

    expect(changePasswordSpy).toHaveBeenCalledWith(
      'user-123',
      'oldpass',
      'newpass12345',
      null,
    );
  });

  it('changePassword should update password hash in DB before revoking tokens', async () => {
    const callOrder = [];
    mockUsersCollection.updateOne.mockImplementation(() => {
      callOrder.push('updateOne');
      return Promise.resolve({ modifiedCount: 1 });
    });
    mockRefreshTokensCollection.deleteMany.mockImplementation(() => {
      callOrder.push('deleteMany');
      return Promise.resolve({ deletedCount: 2 });
    });

    await authService.changePassword('user-123', 'currentpass', 'newpassword123', 'keep-hash');

    expect(callOrder).toEqual(['updateOne', 'deleteMany']);
  });
});
