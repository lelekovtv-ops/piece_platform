import { vi, describe, it, expect, beforeEach } from 'vitest';

// -- Shared mock collections ---------------------------------------------------

const mockSessionsCollection = {
  findOne: vi.fn(),
  find: vi.fn(),
  insertOne: vi.fn(),
  updateOne: vi.fn(),
  updateMany: vi.fn(),
  countDocuments: vi.fn(),
  deleteOne: vi.fn(),
  deleteMany: vi.fn(),
};

const mockRefreshTokensCollection = {
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  insertOne: vi.fn(),
  deleteOne: vi.fn(),
  deleteMany: vi.fn(),
};

const mockUsersCollection = {
  findOne: vi.fn(),
  insertOne: vi.fn(),
  updateOne: vi.fn(),
};

// -- Mocks (BEFORE any imports) ------------------------------------------------

vi.mock('@piece/multitenancy', () => ({
  getGlobalSystemCollection: vi.fn((name) => {
    if (name === 'auth_sessions') return mockSessionsCollection;
    if (name === 'refresh_tokens') return mockRefreshTokensCollection;
    if (name === 'users') return mockUsersCollection;
    return mockSessionsCollection;
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
        JWT_PRIVATE_KEY_BASE64: Buffer.from('test-private-key').toString('base64'),
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_REFRESH_EXPIRES_IN: '30d',
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

// -- Dynamic imports AFTER mocks -----------------------------------------------

const { sessionService } = await import('../session-service.js');
const { authService } = await import('../service.js');
const jwtMod = (await import('jsonwebtoken')).default;
const { teamService } = await import('../../teams/service.js');

// ==============================================================================
// Session Service — Max 10 Sessions Per User
// ==============================================================================

describe('SessionService — EISERN max sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionsCollection.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
      toArray: vi.fn().mockResolvedValue([]),
    });
  });

  describe('createSession — max 10 sessions per user', () => {
    it('should create a session when under the limit', async () => {
      mockSessionsCollection.countDocuments.mockResolvedValueOnce(3);
      mockSessionsCollection.insertOne.mockResolvedValueOnce({ insertedId: 'session-1' });

      const sessionId = await sessionService.createSession('user-1', 'token-hash-1', {
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      });

      expect(sessionId).toBe('session-1');
      expect(mockSessionsCollection.countDocuments).toHaveBeenCalledWith({
        userId: 'user-1',
        revokedAt: null,
      });
      expect(mockSessionsCollection.findOne).not.toHaveBeenCalled();
      expect(mockSessionsCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          refreshTokenHash: 'token-hash-1',
          ip: '127.0.0.1',
          revokedAt: null,
        }),
      );
    });

    it('should revoke oldest session when count reaches MAX_SESSIONS_PER_USER (10)', async () => {
      const oldestSession = {
        _id: 'oldest-session-id',
        userId: 'user-1',
        lastActiveAt: new Date('2026-01-01'),
      };

      mockSessionsCollection.countDocuments.mockResolvedValueOnce(10);
      mockSessionsCollection.findOne.mockResolvedValueOnce(oldestSession);
      mockSessionsCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 });
      mockSessionsCollection.insertOne.mockResolvedValueOnce({ insertedId: 'new-session-id' });

      const sessionId = await sessionService.createSession('user-1', 'new-token-hash', {
        ip: '10.0.0.1',
        userAgent: 'Chrome/120',
      });

      expect(sessionId).toBe('new-session-id');

      expect(mockSessionsCollection.findOne).toHaveBeenCalledWith(
        { userId: 'user-1', revokedAt: null },
        { sort: { lastActiveAt: 1 } },
      );

      expect(mockSessionsCollection.updateOne).toHaveBeenCalledWith(
        { _id: 'oldest-session-id' },
        { $set: { revokedAt: expect.any(Date) } },
      );

      expect(mockSessionsCollection.insertOne).toHaveBeenCalledTimes(1);
    });

    it('should revoke oldest session when count exceeds 10', async () => {
      const oldestSession = {
        _id: 'oldest-id',
        userId: 'user-1',
        lastActiveAt: new Date('2025-12-01'),
      };

      mockSessionsCollection.countDocuments.mockResolvedValueOnce(12);
      mockSessionsCollection.findOne.mockResolvedValueOnce(oldestSession);
      mockSessionsCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 });
      mockSessionsCollection.insertOne.mockResolvedValueOnce({ insertedId: 'new-session' });

      await sessionService.createSession('user-1', 'hash', { ip: '1.1.1.1', userAgent: '' });

      expect(mockSessionsCollection.updateOne).toHaveBeenCalledWith(
        { _id: 'oldest-id' },
        { $set: { revokedAt: expect.any(Date) } },
      );
    });

    it('should still create session if oldest lookup returns null', async () => {
      mockSessionsCollection.countDocuments.mockResolvedValueOnce(10);
      mockSessionsCollection.findOne.mockResolvedValueOnce(null);
      mockSessionsCollection.insertOne.mockResolvedValueOnce({ insertedId: 'session-new' });

      const sessionId = await sessionService.createSession('user-1', 'hash', {
        ip: '127.0.0.1',
        userAgent: '',
      });

      expect(sessionId).toBe('session-new');
      expect(mockSessionsCollection.updateOne).not.toHaveBeenCalled();
      expect(mockSessionsCollection.insertOne).toHaveBeenCalledTimes(1);
    });

    it('should not revoke any session when count is 9', async () => {
      mockSessionsCollection.countDocuments.mockResolvedValueOnce(9);
      mockSessionsCollection.insertOne.mockResolvedValueOnce({ insertedId: 'session-id' });

      await sessionService.createSession('user-1', 'hash', { ip: '127.0.0.1', userAgent: '' });

      expect(mockSessionsCollection.findOne).not.toHaveBeenCalled();
      expect(mockSessionsCollection.updateOne).not.toHaveBeenCalled();
    });

    it('should parse device info from user agent string', async () => {
      mockSessionsCollection.countDocuments.mockResolvedValueOnce(0);
      mockSessionsCollection.insertOne.mockResolvedValueOnce({ insertedId: 'session-id' });

      await sessionService.createSession('user-1', 'hash', {
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      const insertArg = mockSessionsCollection.insertOne.mock.calls[0][0];
      expect(insertArg.deviceInfo).toBeDefined();
      expect(insertArg.deviceInfo.browser).toContain('Chrome');
      expect(insertArg.deviceInfo.os).toMatch(/mac/i);
      expect(insertArg.deviceInfo.deviceType).toBe('desktop');
    });

    it('should set ip to "unknown" when ip is not provided', async () => {
      mockSessionsCollection.countDocuments.mockResolvedValueOnce(0);
      mockSessionsCollection.insertOne.mockResolvedValueOnce({ insertedId: 'session-id' });

      await sessionService.createSession('user-1', 'hash', { userAgent: '' });

      const insertArg = mockSessionsCollection.insertOne.mock.calls[0][0];
      expect(insertArg.ip).toBe('unknown');
    });
  });
});

// ==============================================================================
// AuthService — Atomic Refresh Token Rotation + Reuse Detection
// ==============================================================================

describe('AuthService — EISERN refresh token rotation', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    jwtMod.verify.mockReturnValue({ sub: 'user-id', type: 'refresh' });
    jwtMod.sign.mockReturnValue('mock.jwt.token');
    teamService.listByUser.mockResolvedValue([{ id: 'team-id', role: 'owner' }]);
  });

  describe('refreshAccessToken — atomic rotation via findOneAndUpdate', () => {
    it('should atomically rotate token using findOneAndUpdate', async () => {
      mockRefreshTokensCollection.findOne.mockResolvedValueOnce({
        tokenHash: 'current-hash',
        userId: 'user-id',
      });
      mockUsersCollection.findOne.mockResolvedValueOnce({
        _id: 'user-id',
        email: 'test@example.com',
      });
      mockRefreshTokensCollection.findOneAndUpdate.mockResolvedValueOnce({
        tokenHash: 'new-hash',
        replacedHash: 'current-hash',
        userId: 'user-id',
      });

      const result = await authService.refreshAccessToken('valid-refresh-token');

      expect(result).not.toBeNull();
      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.refreshToken).toBe('mock.jwt.token');

      expect(mockRefreshTokensCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { tokenHash: expect.any(String) },
        {
          $set: expect.objectContaining({
            tokenHash: expect.any(String),
            replacedHash: expect.any(String),
            replacedAt: expect.any(Date),
            createdAt: expect.any(Date),
            expiresAt: expect.any(Date),
          }),
        },
        { returnDocument: 'after' },
      );
    });

    it('should return null when findOneAndUpdate returns null (concurrent rotation)', async () => {
      mockRefreshTokensCollection.findOne.mockResolvedValueOnce({
        tokenHash: 'current-hash',
        userId: 'user-id',
      });
      mockUsersCollection.findOne.mockResolvedValueOnce({
        _id: 'user-id',
        email: 'test@example.com',
      });
      mockRefreshTokensCollection.findOneAndUpdate.mockResolvedValueOnce(null);

      const result = await authService.refreshAccessToken('valid-refresh-token');

      expect(result).toBeNull();
    });
  });

  describe('refreshAccessToken — grace period (30s)', () => {
    it('should accept old token reuse within grace period', async () => {
      mockRefreshTokensCollection.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          replacedHash: 'old-token-hash',
          replacedAt: new Date(Date.now() - 10_000),
          userId: 'user-id',
        });

      mockUsersCollection.findOne.mockResolvedValueOnce({
        _id: 'user-id',
        email: 'test@example.com',
      });

      const result = await authService.refreshAccessToken('old-token');

      expect(result).not.toBeNull();
      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.refreshToken).toBe('old-token');

      expect(mockRefreshTokensCollection.deleteMany).not.toHaveBeenCalled();
    });

    it('should return access token but keep the same refresh token during grace period', async () => {
      mockRefreshTokensCollection.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          replacedHash: 'old-hash',
          replacedAt: new Date(Date.now() - 5_000),
          userId: 'user-id',
        });

      mockUsersCollection.findOne.mockResolvedValueOnce({
        _id: 'user-id',
        email: 'test@example.com',
      });

      const result = await authService.refreshAccessToken('grace-period-token');

      expect(result.refreshToken).toBe('grace-period-token');
    });

    it('should return null when user not found during grace period lookup', async () => {
      mockRefreshTokensCollection.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          replacedHash: 'old-hash',
          replacedAt: new Date(Date.now() - 5_000),
          userId: 'user-id',
        });

      mockUsersCollection.findOne.mockResolvedValueOnce(null);

      const result = await authService.refreshAccessToken('grace-period-token');

      expect(result).toBeNull();
    });
  });

  describe('refreshAccessToken — reuse detection after grace period', () => {
    it('should revoke all user tokens on reuse after grace period', async () => {
      mockRefreshTokensCollection.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          replacedHash: 'stale-hash',
          replacedAt: new Date(Date.now() - 60_000),
          userId: 'compromised-user-id',
        });

      mockRefreshTokensCollection.deleteMany.mockResolvedValueOnce({ deletedCount: 5 });

      const result = await authService.refreshAccessToken('stolen-token');

      expect(result).toBeNull();

      expect(mockRefreshTokensCollection.deleteMany).toHaveBeenCalledWith({
        userId: 'compromised-user-id',
      });
    });

    it('should return null when token hash not found at all (no reuse)', async () => {
      mockRefreshTokensCollection.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await authService.refreshAccessToken('unknown-token');

      expect(result).toBeNull();
      expect(mockRefreshTokensCollection.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken — JWT verification', () => {
    it('should return null for invalid JWT', async () => {
      jwtMod.verify.mockImplementationOnce(() => {
        throw new Error('invalid token');
      });

      const result = await authService.refreshAccessToken('bad-jwt');

      expect(result).toBeNull();
      expect(mockRefreshTokensCollection.findOne).not.toHaveBeenCalled();
    });

    it('should return null when token type is not refresh', async () => {
      jwtMod.verify.mockReturnValueOnce({ sub: 'user-id', type: 'access' });

      const result = await authService.refreshAccessToken('wrong-type-token');

      expect(result).toBeNull();
    });
  });
});
