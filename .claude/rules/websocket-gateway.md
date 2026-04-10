# WebSocket Gateway

## Overview

Real-time collaboration service built on Socket.IO with Redis adapter for horizontal scaling.

Location: `apps/backend/websocket-gateway/src/`

## Configuration

| Field | Default | Description |
|-------|---------|-------------|
| `PORT` | 4031 | Service port |
| `JWT_PUBLIC_KEY_BASE64` | (required) | RS256 public key for token verification |
| `REDIS_URL` | `redis://localhost:6384` | Redis for Socket.IO adapter |
| `WS_CORS_ORIGINS` | `http://localhost:5200,http://localhost:4030` | Comma-separated allowed origins |

## Architecture

- **Transport:** WebSocket only (no long-polling)
- **Namespace:** `/events` -- main event delivery channel
- **Scaling:** Redis adapter (`@socket.io/redis-adapter` + `ioredis`)
- **Auth:** JWT verification on connection handshake

## Authentication

Token from `socket.handshake.auth.token` OR `socket.handshake.headers.authorization`.

Verified via `@piece/auth-middleware` (RS256 public key). On failure: `Error('Authentication required')` or `Error('Invalid or expired token')`.

**Token recheck:** Every 5 minutes (`TOKEN_RECHECK_INTERVAL_MS = 300_000`). If expired, emits `token_expired` and disconnects.

**Token refresh:** Client sends `update_token` event with new token during active session.

## Connection Flow

1. Client connects to `/events` namespace with auth token
2. Server verifies JWT, attaches user to `socket.data.user`
3. Client sends query params: `teamId`, `userId`
4. Socket auto-joins rooms: `team:{teamId}`, `user:{userId}`

## Room Naming

| Room | Pattern | Purpose |
|------|---------|---------|
| Team | `team:{teamId}` | All users in a team |
| User | `user:{userId}` | Specific user targeting |
| Project | `project:{projectId}` | Collaboration within a project |

## Event Contract

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join-project` | `{ projectId }` | Join project room, start presence |
| `leave-project` | -- | Leave project room, release locks |
| `op` | `operation` (with `opId`) | Send operation to collaborators |
| `lock` | `{ sceneId }` | Request scene-level lock |
| `unlock` | `{ sceneId }` | Release scene lock |
| `presence` | `{ cursor }` | Update cursor/presence state |
| `update_token` | `newToken` | Refresh JWT during session |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `presence:update` | `[{ userId, name, cursor }]` | Full presence list for room |
| `user:joined` | `{ userId, name }` | User joined project |
| `user:left` | `{ userId }` | User left project |
| `op` | `{ op, userId, timestamp }` | Operation broadcast |
| `op:ack` | `{ opId }` | Operation acknowledged |
| `lock:ok` | `{ sceneId }` | Lock granted (to requester) |
| `lock:denied` | `{ sceneId, userName }` | Lock denied (to requester) |
| `lock:acquired` | `{ sceneId, userId, userName }` | Lock acquired (to others) |
| `lock:released` | `{ sceneId }` | Lock released (to all) |
| `token_expired` | -- | JWT expired, client must reconnect |

## Scene Locking

| Parameter | Value |
|-----------|-------|
| Lock TTL | 5 minutes (`LOCK_TTL_MS = 300_000`) |
| Cleanup interval | 60 seconds |
| Lock key format | `{projectId}:{sceneId}` |
| Storage | In-memory Map |

Lock object: `{ socketId, userId, userName, expiresAt }`.

- Only one user can lock a scene at a time
- Lock auto-expires after 5 minutes
- On disconnect: all user locks are released
- Expired locks cleaned every 60 seconds

## Metrics

Exposed at `GET /internal/metrics/prometheus` (Prometheus format):

| Metric | Type | Description |
|--------|------|-------------|
| `ws_connections_active` | gauge | Current WebSocket connections |
| `ws_connections_total` | counter | Total connections since start |
| `ws_rooms_active` | gauge | Current active rooms |
| `process_memory_rss_bytes` | gauge | Resident set size |
| `process_heap_used_bytes` | gauge | Heap usage |
| `process_cpu_user_seconds_total` | counter | CPU user time |
| `process_cpu_system_seconds_total` | counter | CPU system time |
| `process_uptime_seconds` | gauge | Process uptime |

## NATS → WebSocket Bridge

Example subscriber pattern in `services/exampleSubscriber.js`:

```javascript
subscribe('EXAMPLE_STREAM', 'ws-example', (event) => {
  io.to(`team:${event.data.teamId}`).emit(event.type, { type, data, timestamp });
}, { filterSubject: 'piece.example.events.>' });
```

## Anti-patterns

- **NEVER** use long-polling transport -- WebSocket only
- **NEVER** skip JWT verification on connection
- **NEVER** store locks in Redis -- in-memory Map with TTL cleanup
- **NEVER** broadcast to all sockets -- use room-scoped emission
- **NEVER** forget to release locks on disconnect
