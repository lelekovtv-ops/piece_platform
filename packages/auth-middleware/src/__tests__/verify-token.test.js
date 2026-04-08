import { vi, describe, it, expect } from 'vitest';

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn().mockReturnValue({
      sub: 'user-123',
      email: 'user@example.com',
      role: 'admin',
    }),
  },
}));

const { createAuthMiddleware } = await import('../index.js');

const mockConfig = {
  get: vi.fn((key) => {
    if (key === 'JWT_PUBLIC_KEY_BASE64') {
      return Buffer.from('test-public-key').toString('base64');
    }
    if (key === 'INTERNAL_TOKEN') return 'test-internal-token';
    return '';
  }),
};

describe('createAuthMiddleware — verifyToken', () => {
  it('should return verifyToken function', () => {
    const auth = createAuthMiddleware({ config: mockConfig });
    expect(typeof auth.verifyToken).toBe('function');
  });

  it('should return decoded user from valid token', () => {
    const { verifyToken } = createAuthMiddleware({ config: mockConfig });
    const user = verifyToken('valid.jwt.token');

    expect(user).toEqual({
      id: 'user-123',
      email: 'user@example.com',
      role: 'admin',
      sub: 'user-123',
    });
  });

  it('should return null for invalid token', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    jwt.verify.mockImplementationOnce(() => {
      throw new Error('invalid signature');
    });

    const { verifyToken } = createAuthMiddleware({ config: mockConfig });
    const user = verifyToken('invalid.token');

    expect(user).toBeNull();
  });
});
