# Auth Flow

## Overview

Multi-method authentication system with account lockout, session management, device fingerprinting, and magic links.

Location: `apps/backend/piece/src/modules/auth/`

## Endpoints

### Public (rate limited: 10 req/60s)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/auth/register` | Register with email/password/name. Creates personal team. Returns user + accessToken + refreshToken (cookie) |
| POST | `/v1/auth/login` | Login with email/password. Checks lockout. Records failed attempts |
| POST | `/v1/auth/magic-link` | Send passwordless magic link email. Max 3/day per email |
| POST | `/v1/auth/magic-link/verify` | Verify magic link token. Auto-creates user if new |
| POST | `/v1/auth/refresh` | Refresh access token using refresh token from cookie/body |

### Protected (JWT required)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/auth/logout` | Logout current session. Clears cookie + DB token |
| GET | `/v1/auth/me` | Get current user profile |
| POST | `/v1/auth/change-password` | Change password (requires current password) |
| GET | `/v1/auth/sessions` | List all active sessions with device info |
| DELETE | `/v1/auth/sessions/:sessionId` | Revoke specific session |
| DELETE | `/v1/auth/sessions` | Revoke all sessions except current |

### Admin (internal token required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/auth/audit-log` | Global audit log (filterable, paginated max 200) |
| GET | `/admin/auth/audit-log/user/:userId` | User-specific audit log |

## JWT Strategy

| Token | Algorithm | Secret | Lifetime | Storage |
|-------|-----------|--------|----------|---------|
| Access | RS256 (asymmetric) | `JWT_PRIVATE_KEY_BASE64` / `JWT_PUBLIC_KEY_BASE64` | Configurable via `JWT_EXPIRES_IN` (default 15m) | In-memory (frontend) |
| Refresh | HS256 (symmetric) | `JWT_REFRESH_SECRET` | 30 days | HttpOnly cookie (`piece_rt`) + MongoDB |

### Access Token Claims

```javascript
{ sub: userId, email, role, jti: randomUUID(), iat, exp }
```

### Refresh Token Storage (MongoDB: `refresh_tokens`)

```javascript
{ userId, tokenHash: SHA256(token), createdAt, expiresAt, replacedHash, replacedAt }
```

Tokens are **never stored in plaintext** -- only SHA256 hashes.

## Refresh Token Grace Period

**Grace period: 30 seconds** (`REFRESH_TOKEN_GRACE_PERIOD_MS = 30_000`).

When a refresh token is rotated, the old token hash is stored in `replacedHash` with `replacedAt`. If the old token is replayed within 30s, it is accepted (prevents race conditions in concurrent requests).

## Account Lockout

| Parameter | Value |
|-----------|-------|
| Max failed attempts | 5 |
| Lockout duration | 15 minutes (900s) |
| Storage | Redis (primary) + in-memory (fallback) |

Flow:
1. `isLocked(email)` -- check before login
2. `recordFailedAttempt(email)` -- on wrong password
3. `resetAttempts(email)` -- on successful login

## Suspicious Activity Detection

Triggers when **both** conditions met within 1 hour:
- 10+ failed login attempts (`FAILED_LOGIN_THRESHOLD`)
- 3+ unique IP addresses (`UNIQUE_IP_THRESHOLD`)

Storage: Redis sorted set (`piece:suspicious:failed:{email}`), members `{ip}:{timestamp}`, auto-expires in 1 hour.

Detection is **warning-only** (logged but does not block). Blocking is handled by account lockout.

## Magic Links

| Parameter | Value |
|-----------|-------|
| Token | `crypto.randomBytes(32).toString('hex')` (64 chars) |
| TTL | `StandardTTL.verification` (15 minutes) |
| Max per day | 3 per email (resend limiter) |
| Single-use | Yes (deleted from cache on verification) |

Auto-creates user if email not found. Sets `emailVerified: true` immediately.

## Session Management (MongoDB: `auth_sessions`)

```javascript
{
  userId,
  refreshTokenHash: SHA256(token),
  deviceInfo: { browser, os, deviceType, userAgent },
  ip,
  lastActiveAt,  // updated on token refresh
  createdAt,
  revokedAt      // null until revoked
}
```

Device fingerprinting via `ua-parser-js`: browser name+version, OS name+version, device type (desktop/mobile/tablet/unknown).

No hard session limit. Cleanup: old refresh tokens >3 days deleted on login.

## Audit Logging (MongoDB: `auth_audit_log`)

Events: `login_success`, `login_failed`, `register`, `logout`, `password_change`, `magic_link_sent`, `magic_link_verified`, `session_revoked`, `all_sessions_revoked`, `account_locked`.

Logging is **fire-and-forget** (not awaited, errors suppressed).

## Password Requirements

- Minimum length: 8 characters
- Hashing: bcrypt, 12 rounds (`BCRYPT_ROUNDS = 12`)

## Email Validation on Registration

1. `validateEmailDomain(email)` -- rejects disposable domains
2. `validateMxRecord(email)` -- verifies MX record exists (graceful fail-open)

## Refresh Token Cookie

```javascript
{
  httpOnly: true,
  secure: NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/v1/auth',
  maxAge: 30 * 24 * 60 * 60 * 1000  // 30 days
}
```

## Anti-patterns

- **NEVER** store access tokens in localStorage -- memory only
- **NEVER** store refresh tokens in plaintext -- SHA256 hash only
- **NEVER** skip account lockout check on login
- **NEVER** skip email domain validation on registration
- **NEVER** allow unlimited magic link resends -- use resend limiter
- **NEVER** await audit log writes -- fire-and-forget only
