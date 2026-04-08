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
        JWT_PRIVATE_KEY_BASE64: Buffer.from('test-private-key-for-unit-tests').toString('base64'),
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_REFRESH_EXPIRES_IN: '30d',
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

const { _mockCollection: mockCollection } = await import('@piece/multitenancy');
const { authService } = await import('../service.js');

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user and return tokens', async () => {
      mockCollection.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          _id: 'new-id',
          email: 'test@example.com',
          name: 'Test User',
          avatarUrl: null,
          language: 'en',
          emailVerified: false,
          createdAt: new Date(),
        });
      mockCollection.insertOne
        .mockResolvedValueOnce({ insertedId: 'new-id' })
        .mockResolvedValueOnce({ insertedId: 'token-id' });

      const result = await authService.register({
        email: 'Test@Example.com',
        password: 'securepassword123',
        name: 'Test User',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.user.name).toBe('Test User');
      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.refreshToken).toBe('mock.jwt.token');
    });

    it('should throw EMAIL_TAKEN if user exists', async () => {
      mockCollection.findOne.mockResolvedValueOnce({ _id: 'existing', email: 'test@example.com' });

      await expect(
        authService.register({ email: 'test@example.com', password: 'password123' }),
      ).rejects.toThrow('Email is already registered');
    });

    it('should throw WEAK_PASSWORD for short password', async () => {
      mockCollection.findOne.mockResolvedValueOnce(null);

      await expect(
        authService.register({ email: 'test@example.com', password: 'short' }),
      ).rejects.toThrow('Password must be at least 8 characters');
    });

    it('should normalize email to lowercase', async () => {
      mockCollection.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          _id: 'new-id',
          email: 'user@domain.com',
          name: 'user',
          createdAt: new Date(),
        });
      mockCollection.insertOne
        .mockResolvedValueOnce({ insertedId: 'new-id' })
        .mockResolvedValueOnce({ insertedId: 'token-id' });

      await authService.register({
        email: 'USER@DOMAIN.COM',
        password: 'password123',
      });

      expect(mockCollection.findOne).toHaveBeenCalledWith({ email: 'user@domain.com' });
    });

    it('should use email username as name when no name provided', async () => {
      mockCollection.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          _id: 'new-id',
          email: 'john@example.com',
          name: 'john',
          createdAt: new Date(),
        });
      mockCollection.insertOne
        .mockResolvedValueOnce({ insertedId: 'new-id' })
        .mockResolvedValueOnce({ insertedId: 'token-id' });

      await authService.register({
        email: 'john@example.com',
        password: 'password123',
      });

      const insertCall = mockCollection.insertOne.mock.calls[0][0];
      expect(insertCall.name).toBe('john');
    });
  });

  describe('login', () => {
    it('should return tokens on valid credentials', async () => {
      mockCollection.findOne.mockResolvedValueOnce({
        _id: 'user-id',
        email: 'test@example.com',
        name: 'Test',
        passwordHash: '$2b$12$hashed',
      });
      mockCollection.insertOne.mockResolvedValueOnce({ insertedId: 'token-id' });

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).not.toBeNull();
      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBe('mock.jwt.token');
    });

    it('should return null for non-existent user', async () => {
      mockCollection.findOne.mockResolvedValueOnce(null);

      const result = await authService.login({
        email: 'nobody@example.com',
        password: 'password123',
      });

      expect(result).toBeNull();
    });

    it('should return null for wrong password', async () => {
      const bcrypt = (await import('bcrypt')).default;
      bcrypt.compare.mockResolvedValueOnce(false);

      mockCollection.findOne.mockResolvedValueOnce({
        _id: 'user-id',
        email: 'test@example.com',
        passwordHash: '$2b$12$hashed',
      });

      const result = await authService.login({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(result).toBeNull();
    });

    it('should clean up old refresh tokens on login', async () => {
      mockCollection.findOne.mockResolvedValueOnce({
        _id: 'user-id',
        email: 'test@example.com',
        name: 'Test',
        passwordHash: '$2b$12$hashed',
      });
      mockCollection.deleteMany.mockResolvedValueOnce({ deletedCount: 2 });
      mockCollection.insertOne.mockResolvedValueOnce({ insertedId: 'token-id' });

      await authService.login({ email: 'test@example.com', password: 'password123' });

      expect(mockCollection.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-id',
        }),
      );
    });
  });

  describe('refreshAccessToken', () => {
    it('should return new tokens with valid refresh token', async () => {
      mockCollection.findOne
        .mockResolvedValueOnce({ token: 'valid-token' })
        .mockResolvedValueOnce({ _id: 'user-id', email: 'test@example.com' });
      mockCollection.deleteOne.mockResolvedValueOnce({ deletedCount: 1 });
      mockCollection.insertOne.mockResolvedValueOnce({ insertedId: 'new-token-id' });

      const result = await authService.refreshAccessToken('valid-token');

      expect(result).not.toBeNull();
      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.refreshToken).toBe('mock.jwt.token');
    });

    it('should return null for invalid token', async () => {
      const jwtMod = (await import('jsonwebtoken')).default;
      jwtMod.verify.mockImplementationOnce(() => {
        throw new Error('invalid token');
      });

      const result = await authService.refreshAccessToken('bad-token');
      expect(result).toBeNull();
    });
  });

  describe('logout', () => {
    it('should delete refresh token', async () => {
      mockCollection.deleteOne.mockResolvedValueOnce({ deletedCount: 1 });

      await authService.logout('some-refresh-token');

      expect(mockCollection.deleteOne).toHaveBeenCalledWith({ token: 'some-refresh-token' });
    });

    it('should handle null refresh token', async () => {
      await authService.logout(null);
      expect(mockCollection.deleteOne).not.toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('should return sanitized user', async () => {
      mockCollection.findOne.mockResolvedValueOnce({
        _id: 'user-id',
        email: 'test@example.com',
        name: 'Test',
        passwordHash: 'secret',
        language: 'ru',
      });

      const user = await authService.getProfile('user-id');

      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test');
      expect(user.language).toBe('ru');
      expect(user.passwordHash).toBeUndefined();
    });
  });
});
