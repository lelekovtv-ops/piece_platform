import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockCacheStore = new Map();

vi.mock('@piece/cache', () => ({
  createCache: vi.fn(() => ({
    get: vi.fn((key) => Promise.resolve(mockCacheStore.get(key) ?? null)),
    set: vi.fn((key, value) => { mockCacheStore.set(key, value); return Promise.resolve(); }),
    del: vi.fn((key) => { mockCacheStore.delete(key); return Promise.resolve(); }),
  })),
  StandardTTL: { verification: 900 },
}));

vi.mock('@piece/multitenancy', () => {
  const mockCollection = {
    findOne: vi.fn(),
    insertOne: vi.fn(),
    updateOne: vi.fn(),
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
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  })),
}));

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const defaults = {
        FRONTEND_URL: 'http://localhost:5200',
        NODE_ENV: 'development',
        DISABLE_EMAIL_SENDING: 'true',
      };
      return defaults[key] ?? '';
    }),
  },
}));

const { _mockCollection: mockCollection } = await import('@piece/multitenancy');
const { generateMagicLink, verifyMagicLink } = await import('../magic-link-service.js');

describe('MagicLinkService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheStore.clear();
  });

  describe('generateMagicLink', () => {
    it('should generate a token and URL', async () => {
      const result = await generateMagicLink('Test@Example.com');

      expect(result.email).toBe('test@example.com');
      expect(result.token).toHaveLength(64);
      expect(result.url).toContain('http://localhost:5200/auth/verify?token=');
      expect(mockCacheStore.size).toBe(1);
    });

    it('should store email in cache', async () => {
      const result = await generateMagicLink('user@piece.dev');
      const cached = mockCacheStore.get(result.token);

      expect(cached).toEqual({ email: 'user@piece.dev' });
    });
  });

  describe('verifyMagicLink', () => {
    it('should return null for non-existent token', async () => {
      const result = await verifyMagicLink('nonexistent-token');
      expect(result).toBeNull();
    });

    it('should return existing user and delete token', async () => {
      const existingUser = {
        _id: 'user-123',
        email: 'test@example.com',
        name: 'Test',
        emailVerified: true,
      };
      mockCacheStore.set('valid-token', { email: 'test@example.com' });
      mockCollection.findOne.mockResolvedValueOnce(existingUser);

      const result = await verifyMagicLink('valid-token');

      expect(result.email).toBe('test@example.com');
      expect(mockCacheStore.has('valid-token')).toBe(false);
    });

    it('should auto-create user if not found', async () => {
      const newUser = {
        _id: 'new-user-id',
        email: 'newuser@example.com',
        name: 'newuser',
        emailVerified: true,
      };
      mockCacheStore.set('new-token', { email: 'newuser@example.com' });
      mockCollection.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(newUser);
      mockCollection.insertOne.mockResolvedValueOnce({ insertedId: 'new-user-id' });

      const result = await verifyMagicLink('new-token');

      expect(result.email).toBe('newuser@example.com');
      expect(mockCollection.insertOne).toHaveBeenCalled();
      expect(mockCacheStore.has('new-token')).toBe(false);
    });

    it('should mark email as verified if not yet verified', async () => {
      const unverifiedUser = {
        _id: 'user-456',
        email: 'unverified@example.com',
        emailVerified: false,
      };
      mockCacheStore.set('verify-token', { email: 'unverified@example.com' });
      mockCollection.findOne.mockResolvedValueOnce(unverifiedUser);

      const result = await verifyMagicLink('verify-token');

      expect(result.emailVerified).toBe(true);
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: 'user-456' },
        { $set: { emailVerified: true, updatedAt: expect.any(Date) } },
      );
    });
  });
});
