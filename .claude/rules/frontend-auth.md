# Frontend Auth

## Overview

Three-layer authentication: API client → Zustand store → intelligent fetch wrapper with auto-retry and token refresh.

Location: `apps/frontend/src/lib/auth/`

## Token Strategy

| Token | Storage | Lifetime |
|-------|---------|----------|
| Access token | In-memory variable (NOT localStorage) | ~15 minutes |
| Refresh token | HttpOnly cookie (`piece_rt`) | 30 days |

Access token is managed via `getAccessToken()` / `setAccessToken()` in `auth-client.ts`.

## Auth Client (`auth-client.ts`)

Low-level API calls. All requests use `credentials: "include"` to send cookies.

| Function | Method | Endpoint | Auth |
|----------|--------|----------|------|
| `loginApi(email, password)` | POST | `/v1/auth/login` | None |
| `registerApi(email, password, name?)` | POST | `/v1/auth/register` | None |
| `refreshApi()` | POST | `/v1/auth/refresh` | Cookie only |
| `logoutApi()` | POST | `/v1/auth/logout` | Bearer token |
| `getMeApi()` | GET | `/v1/auth/me` | Bearer token |

**API_BASE:** `process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4030"`

**Refresh deduplication:** `refreshApi()` uses a singleton `refreshPromise` to prevent concurrent refresh calls. Multiple callers share the same promise.

## Auth Store (`auth-store.ts`)

Zustand store: `useAuthStore()`.

### Shape

```typescript
{
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login(email, password): Promise<void>
  register(email, password, name?): Promise<void>
  logout(): Promise<void>
  initialize(): Promise<void>
}
```

### Initialization Flow

Called on app load:
1. `refreshApi()` -- restore session from cookie
2. If successful: `setAccessToken()`, `getMeApi()`, `selectFirstTeam()`
3. `identifyUser()` for analytics
4. On failure: clear user state

### Team Auto-Selection

`selectFirstTeam()` called automatically on login/register/initialize:
1. Fetches `GET /v1/teams` via `authFetch`
2. Sets `currentTeamId` to first team's ID
3. Errors silently caught (team selection is optional at auth time)

## Auth Fetch (`auth-fetch.ts`)

Intelligent HTTP wrapper used for all authenticated API calls.

### Configuration

| Parameter | Value |
|-----------|-------|
| Max retries | 2 (`MAX_RETRIES`) |
| Request timeout | 15 seconds (`REQUEST_TIMEOUT_MS`) |
| Retryable statuses | 429, 500, 502, 503 |

### Headers (auto-added)

| Header | Value | Condition |
|--------|-------|-----------|
| `Authorization` | `Bearer {token}` | If access token exists |
| `x-selected-team` | `{teamId}` | If `currentTeamId` set |
| `X-Correlation-ID` | UUID | Always |
| `Content-Type` | `application/json` | If body is string and not already set |

### 401 Handling (Auto Token Refresh)

On 401 response (first attempt only):
1. Call `refreshApi()` to get new access token
2. Update `Authorization` header
3. Retry request immediately with new token

### Retry Strategy

- Exponential backoff: `2^attempt * 1000ms` (1s, 2s, 4s)
- Capped at 10 seconds
- Respects `Retry-After` header from server (capped at 10s)
- Each attempt has its own `AbortController` with 15s timeout

### Team Context

```typescript
setCurrentTeamId(id: string | null)  // set after login/team switch
getCurrentTeamId(): string | null     // read by authFetch
```

The `x-selected-team` header is how the backend knows which team context to use.

## Route Protection (`middleware.ts`)

Next.js middleware for server-side route protection.

### Public Routes (no auth check)

- `/login`
- `/healthz`
- `/home`
- `/auth/verify`

### Public Prefixes (bypass entirely)

- `/_next/`
- `/api/`
- `/favicon.ico`

### Protection Logic

Checks for `piece_rt` cookie (refresh token). If missing and not in development: redirect to `/login?redirect={pathname}`.

Development mode allows unauthenticated access.

## Anti-patterns

- **NEVER** store access tokens in localStorage or cookies -- memory only
- **NEVER** call API endpoints directly -- use `authFetch()` for authenticated calls
- **NEVER** create custom fetch wrappers -- use `authFetch()` which handles retry/refresh/headers
- **NEVER** manually set `Authorization` header -- `authFetch()` does it automatically
- **NEVER** skip `credentials: "include"` on auth client calls -- needed for cookie transport
