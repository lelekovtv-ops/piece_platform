# Session Report — April 9, 2026 (Evening): Media Storage & Auth Planning

## Summary

Planning session for core infrastructure: authentication flow, persistent media storage, multi-quality image rendering, and user settings. Conducted deep codebase exploration, researched imgproxy as media processing service, and produced a comprehensive 6-phase master plan.

| Metric | Value |
|--------|-------|
| Session type | Planning & Research |
| Code changes | 0 (planning only) |
| Sub-agents launched | 4 |
| Web pages researched | 2 (imgproxy docs) |

## Work Completed

### 1. Deep Codebase Exploration

- **Frontend auth system**: Explored auth store, auth client, auth fetch, AuthProvider, login page, route structure. Found: login page exists, auth store complete, BUT no route guards — all pages accessible without authentication.
- **Backend auth system**: Explored all auth modules. Found: fully implemented (register, login, refresh, logout, JWT RS256 15min + 30d refresh, bcrypt 12 rounds, account lockout, MX validation, disposable email check). Missing: change-password endpoint.
- **Storage architecture**: Explored MinIO config (3 buckets), upload module (presigned URLs, 1hr expiry), blobAdapter.ts (dual S3 + IndexedDB), fileStorage.ts (IndexedDB blob store). Found: S3_PUBLIC_URL defaults to localhost:9006 — won't work on staging.
- **Media rendering**: Explored library page (1000+ LOC), timeline store, generation pipeline. Found: ALL image processing is client-side (createImageBitmap 320px, JPEG 70%). No server-side processing exists (no sharp, ffmpeg, imagemagick). Videos are raw MP4 via `<video>` tag.
- **Docker infrastructure**: All service memory limits, port allocations, volume mounts documented.

### 2. imgproxy Research

Evaluated imgproxy as the media processing service:
- MIT license, free OSS version
- Uses libvips (fastest image library, ~50ms per resize, low RAM)
- Native S3 support (`IMGPROXY_USE_S3=true`, `IMGPROXY_S3_ENDPOINT`)
- Auto WebP detection via Accept header
- URL-based processing: `/resize:fill:200:200/quality:60/plain/s3://bucket/key`
- Presets for reusable processing configs
- Video thumbnails: Pro-only feature — need client-side fallback
- URL signing via HMAC key/salt for production security

### 3. Master Plan Created (6 Phases)

| Phase | Title | Dependencies |
|-------|-------|-------------|
| 1 | Storage + imgproxy Infrastructure | Blocking — everything depends on this |
| 2 | Auth Route Guards | Parallel with Phase 3 |
| 3 | User Settings | Parallel with Phase 2 |
| 4 | Library S3 Migration | Depends on Phase 1 |
| 5 | Timeline Integration | Depends on Phase 4 |
| 6 | Performance at Scale | After Phase 4 |

### 4. Scale Analysis (1000 Users)

| Dimension | Analysis |
|-----------|----------|
| Storage | ~100GB originals — Hetzner Volume 100-200GB needed |
| Cache | ~2-5GB nginx proxy_cache for hot image variants |
| CPU | 2 vCPU handles ~40 concurrent resizes, >90% cache hit rate |
| RAM | CX23 (4GB) tight for production — recommend CX32+ (8GB) |
| Frontend | Virtual scrolling needed for >500 items (Phase 6) |

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| imgproxy OSS (not Pro) | Free, sufficient for images. Video posters done client-side. |
| Server-side image rendering | Consistent quality, bandwidth savings, nginx-cacheable |
| Client-side video posters | imgproxy OSS doesn't support video thumbnails |
| WebP auto-detection | Free in OSS, 30-50% savings over JPEG |
| nginx proxy_cache (5GB, 7d) | >90% hit rate, avoids re-processing |
| Three quality tiers | thumb (5-15KB), preview (30-80KB), original (0.5-5MB) |
| Hybrid IndexedDB + S3 | IndexedDB as local cache only, S3 is source of truth |

## Three Quality Tiers

| Tier | Use Case | Size | Format | Quality | Est. File Size |
|------|----------|------|--------|---------|---------------|
| thumb | Grid scroll, library cards | 200x200 fill | WebP | 60% | 5-15 KB |
| preview | Timeline shots, blocks | 640px fit | WebP | 75% | 30-80 KB |
| original | Fullscreen, screenshots, export | Raw source | Original | 100% | 0.5-5 MB |

## URL Architecture

```
# Grid thumbnail
/img/unsafe/pr:thumb/plain/s3://koza-uploads/{teamId}/{projectId}/{folder}/{timestamp}_{filename}

# Timeline preview
/img/unsafe/pr:preview/plain/s3://koza-uploads/{key}

# Original (raw passthrough)
/img/unsafe/pr:original/plain/s3://koza-uploads/{key}

# Direct MinIO access (non-image files)
/storage/koza-uploads/{key}
```

## Next Session Tasks

1. **Execute Phase 1**: Add imgproxy to docker-compose.yml, configure nginx proxy routes, set S3 env vars on staging, verify E2E upload -> imgproxy -> cached response
2. **Execute Phases 2+3 in parallel**: Auth route guards + user settings page
3. **Execute Phase 4**: Library backend API + frontend S3 migration
