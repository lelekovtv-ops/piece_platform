import { vi, describe, it, expect, beforeEach } from 'vitest';

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
        NODE_ENV: 'production',
        JWT_PRIVATE_KEY_BASE64: '',
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

vi.mock('@piece/multitenancy', () => {
  const mockCollection = {
    findOne: vi.fn(),
    insertOne: vi.fn(),
    deleteOne: vi.fn(),
    deleteMany: vi.fn(),
    findOneAndUpdate: vi.fn(),
    countDocuments: vi.fn(),
    find: vi.fn(() => ({ sort: vi.fn(() => ({ skip: vi.fn(() => ({ limit: vi.fn(() => ({ toArray: vi.fn(() => []) })) })) })) })),
  };
  return {
    getGlobalSystemCollection: vi.fn(() => mockCollection),
    getSystemDb: vi.fn(() => ({})),
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

vi.mock('@piece/cache', () => ({
  getRedisClient: vi.fn(() => null),
  createCache: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  })),
  initializeServiceCache: vi.fn(),
  StandardTTL: { SHORT: 60, MEDIUM: 300, LONG: 3600, verification: 900 },
}));

vi.mock('@piece/cache/accountLockout', () => ({
  createAccountLockout: vi.fn(),
}));

vi.mock('@piece/cache/resendLimiter', () => ({
  createResendLimiter: vi.fn(),
}));

vi.mock('@piece/validation/email', () => ({
  validateEmailDomain: vi.fn(),
  validateMxRecord: vi.fn().mockResolvedValue(true),
}));

vi.mock('@piece/email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ messageId: 'mock' }),
  initializeEmail: vi.fn(),
}));

vi.mock('../../teams/service.js', () => ({
  teamService: {
    create: vi.fn().mockResolvedValue({ id: 'team-id' }),
    listByUser: vi.fn().mockResolvedValue([{ id: 'team-id', role: 'owner' }]),
  },
}));

vi.mock('../session-service.js', () => ({
  sessionService: {
    createSession: vi.fn().mockResolvedValue({}),
    updateSessionTokenHash: vi.fn().mockResolvedValue({}),
    getActiveSessions: vi.fn().mockResolvedValue([]),
    revokeSession: vi.fn().mockResolvedValue(true),
    revokeAllSessions: vi.fn().mockResolvedValue(0),
  },
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
      MAGIC_LINK_SENT: 'magic_link_sent',
      MAGIC_LINK_VERIFIED: 'magic_link_verified',
      SESSION_REVOKED: 'session_revoked',
      ALL_SESSIONS_REVOKED: 'all_sessions_revoked',
      ACCOUNT_LOCKED: 'account_locked',
      EMAIL_VERIFICATION_SENT: 'email_verification_sent',
      EMAIL_VERIFIED: 'email_verified',
      PASSWORD_RESET_REQUESTED: 'password_reset_requested',
      PASSWORD_RESET_CONFIRMED: 'password_reset_confirmed',
    },
  },
}));

vi.mock('../suspicious-activity.js', () => ({
  recordFailedLoginAndCheck: vi.fn().mockResolvedValue(false),
  clearSuspiciousTracking: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../magic-link-service.js', () => ({
  generateMagicLink: vi.fn(),
  sendMagicLinkEmail: vi.fn(),
  verifyMagicLink: vi.fn(),
}));

vi.mock('../service.js', () => ({
  authService: {
    register: vi.fn(),
    login: vi.fn(),
    issueTokensForUser: vi.fn(),
    refreshAccessToken: vi.fn(),
    logout: vi.fn(),
    getProfile: vi.fn(),
    changePassword: vi.fn(),
    generateEmailVerificationToken: vi.fn(),
    verifyEmailToken: vi.fn(),
    sendVerificationEmail: vi.fn(),
    generateAndSendVerificationEmail: vi.fn(),
    requestPasswordReset: vi.fn(),
    confirmPasswordReset: vi.fn(),
    revokeAllUserTokens: vi.fn(),
  },
}));

vi.mock('../utils.js', () => ({
  hashToken: vi.fn((t) => `hashed_${t}`),
}));

function createMockReq(overrides = {}) {
  return {
    method: 'POST',
    path: '/v1/some/endpoint',
    cookies: {},
    headers: {},
    ...overrides,
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    _body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res._body = body;
      return res;
    },
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  };
  return res;
}

describe('CSRF double-submit cookie middleware', () => {
  let createCsrfMiddleware;
  let middleware;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../../middleware/csrf.js');
    createCsrfMiddleware = mod.createCsrfMiddleware;
    middleware = createCsrfMiddleware();
  });

  it('skips GET requests (safe method)', () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res._body).toBeNull();
  });

  it('skips HEAD requests (safe method)', () => {
    const req = createMockReq({ method: 'HEAD' });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('skips OPTIONS requests (safe method)', () => {
    const req = createMockReq({ method: 'OPTIONS' });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('skips /health path', () => {
    const req = createMockReq({ path: '/health' });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('skips /internal/ paths', () => {
    const req = createMockReq({ path: '/internal/metrics' });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('skips /v1/auth/login (auth exempt)', () => {
    const req = createMockReq({ path: '/v1/auth/login' });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('skips /v1/auth/register (auth exempt)', () => {
    const req = createMockReq({ path: '/v1/auth/register' });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('skips /v1/auth/refresh (auth exempt)', () => {
    const req = createMockReq({ path: '/v1/auth/refresh' });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('skips /v1/auth/magic-link (auth exempt)', () => {
    const req = createMockReq({ path: '/v1/auth/magic-link' });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('skips /v1/auth/magic-link/verify (sub-path of exempt)', () => {
    const req = createMockReq({ path: '/v1/auth/magic-link/verify' });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('skips when no piece_rt cookie AND no Authorization header (unauthenticated)', () => {
    const req = createMockReq({
      path: '/v1/some/resource',
      cookies: {},
      headers: {},
    });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('validates CSRF when piece_rt cookie is present', () => {
    const req = createMockReq({
      path: '/v1/some/resource',
      cookies: { piece_rt: 'some-refresh-token' },
      headers: {},
    });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res._body.error).toBe('CSRF_VALIDATION_FAILED');
  });

  it('validates CSRF when Authorization header is present', () => {
    const req = createMockReq({
      path: '/v1/some/resource',
      cookies: {},
      headers: { authorization: 'Bearer some-token' },
    });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res._body.error).toBe('CSRF_VALIDATION_FAILED');
  });

  it('returns 403 when cookie token is present but header token is missing', () => {
    const req = createMockReq({
      path: '/v1/some/resource',
      cookies: { piece_rt: 'rt', piece_csrf: 'csrf-token-abc' },
      headers: {},
    });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res._body.error).toBe('CSRF_VALIDATION_FAILED');
    expect(res._body.message).toBe('Missing or invalid CSRF token');
  });

  it('returns 403 when header token is present but cookie token is missing', () => {
    const req = createMockReq({
      path: '/v1/some/resource',
      cookies: { piece_rt: 'rt' },
      headers: { 'x-csrf-token': 'csrf-token-abc' },
    });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('returns 403 when cookie and header tokens do not match', () => {
    const req = createMockReq({
      path: '/v1/some/resource',
      cookies: { piece_rt: 'rt', piece_csrf: 'token-A' },
      headers: { 'x-csrf-token': 'token-B' },
    });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res._body.error).toBe('CSRF_VALIDATION_FAILED');
  });

  it('passes when cookie and header tokens match', () => {
    const token = 'valid-csrf-token-12345';
    const req = createMockReq({
      path: '/v1/some/resource',
      cookies: { piece_rt: 'rt', piece_csrf: token },
      headers: { 'x-csrf-token': token },
    });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res._body).toBeNull();
  });

  it('passes for DELETE method when tokens match', () => {
    const token = 'csrf-delete-token';
    const req = createMockReq({
      method: 'DELETE',
      path: '/v1/auth/sessions/abc',
      cookies: { piece_rt: 'rt', piece_csrf: token },
      headers: { 'x-csrf-token': token },
    });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('passes for PUT method when tokens match', () => {
    const token = 'csrf-put-token';
    const req = createMockReq({
      method: 'PUT',
      path: '/v1/resource/123',
      cookies: { piece_rt: 'rt', piece_csrf: token },
      headers: { 'x-csrf-token': token },
    });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});

describe('Refresh token cookie (controller helpers)', () => {
  let authController;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../controller.js');
    authController = mod.authController;
  });

  it('setRefreshTokenCookie sets path /v1/auth, httpOnly, sameSite lax on login', async () => {
    const { authService } = await import('../service.js');

    authService.login.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
      accessToken: 'at-123',
      refreshToken: 'rt-123',
    });

    const req = createMockReq({
      body: { email: 'test@example.com', password: 'password123' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test' },
    });
    const res = createMockRes();

    await authController.login(req, res);

    expect(res.statusCode).not.toBe(500);
    const rtCookieCall = res.cookie.mock.calls.find(
      (call) => call[0] === 'piece_rt',
    );
    expect(rtCookieCall).toBeDefined();
    expect(rtCookieCall[2]).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/v1/auth',
    });
  });

  it('clearRefreshTokenCookie clears at both /v1/auth and / paths on logout', async () => {
    const { authService } = await import('../service.js');
    authService.logout = vi.fn().mockResolvedValue(undefined);

    const req = createMockReq({
      cookies: { piece_rt: 'rt-old' },
      user: { id: 'user-1' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test' },
    });
    const res = createMockRes();

    await authController.logout(req, res);

    const clearCalls = res.clearCookie.mock.calls.filter(
      (call) => call[0] === 'piece_rt',
    );
    expect(clearCalls.length).toBeGreaterThanOrEqual(2);

    const paths = clearCalls.map((call) => call[1]?.path);
    expect(paths).toContain('/v1/auth');
    expect(paths).toContain('/');
  });

  it('setRefreshTokenCookie also clears legacy root path cookie', async () => {
    const { authService } = await import('../service.js');
    authService.login.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
      accessToken: 'at-123',
      refreshToken: 'rt-123',
    });

    const req = createMockReq({
      body: { email: 'test@example.com', password: 'password123' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test' },
    });
    const res = createMockRes();

    await authController.login(req, res);

    const rootClearCall = res.clearCookie.mock.calls.find(
      (call) => call[0] === 'piece_rt' && call[1]?.path === '/',
    );
    expect(rootClearCall).toBeDefined();
  });
});

describe('JWT KID = v1 (signAccessToken)', () => {
  let realPrivateKey;
  let realAuthService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { generateKeyPairSync } = await import('node:crypto');
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    realPrivateKey = privateKey;

    const { config } = await import('../../../config.js');
    config.get.mockImplementation((key) => {
      const vals = {
        NODE_ENV: 'test',
        JWT_PRIVATE_KEY_BASE64: Buffer.from(realPrivateKey).toString('base64'),
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_REFRESH_EXPIRES_IN: '30d',
        FRONTEND_URL: 'http://localhost:5201',
        DISABLE_EMAIL_SENDING: 'true',
      };
      return vals[key] ?? '';
    });

    const { getGlobalSystemCollection } = await import('@piece/multitenancy');
    const mockColl = getGlobalSystemCollection('refresh_tokens');
    mockColl.insertOne.mockResolvedValue({ insertedId: 'rt-doc-id' });

    realAuthService = await vi.importActual('../service.js');
  });

  it('signAccessToken includes keyid v1 in JWT header', async () => {
    const jwt = await import('jsonwebtoken');

    const mockUser = {
      _id: 'user-123',
      email: 'test@example.com',
      name: 'Test',
      emailVerified: true,
      createdAt: new Date(),
    };

    const result = await realAuthService.authService.issueTokensForUser(mockUser);
    const decoded = jwt.default.decode(result.accessToken, { complete: true });

    expect(decoded.header.kid).toBe('v1');
    expect(decoded.header.alg).toBe('RS256');
  });

  it('access token contains sub and email claims', async () => {
    const jwt = await import('jsonwebtoken');

    const mockUser = {
      _id: 'user-456',
      email: 'admin@piece.dev',
      name: 'Admin',
      emailVerified: true,
      createdAt: new Date(),
    };

    const result = await realAuthService.authService.issueTokensForUser(mockUser);
    const decoded = jwt.default.decode(result.accessToken, { complete: true });

    expect(decoded.payload.sub).toBe('user-456');
    expect(decoded.payload.email).toBe('admin@piece.dev');
    expect(decoded.payload.jti).toBeDefined();
  });
});
