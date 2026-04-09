# Image Loading System — Implementation Report

**Date**: 2026-04-09
**Status**: Deployed to staging + production
**Commit**: `bc91957`
**Branch flow**: dev → stage → main

## Summary

Implemented smooth image loading UX, fixed blob URL memory leaks, and migrated all `next/image` imports to unified SmartImage/SmartImg components.

**28 files changed, 602 insertions, 49 deletions.**

## What Was Done

### Phase 1: Infrastructure

| Step | Description | Status |
|------|-------------|--------|
| 1 | Staging nginx — added `/img/` and `/storage/koza-uploads/` proxies | Done |
| 2 | `next.config.ts` — custom image loader, deviceSizes, WebP | Done |
| 3 | `imageLoader.ts` — passthrough loader (imagorvideo handles processing) | Done |

### Phase 2: Blob URL Memory Leak Fix

| Step | Description | Status |
|------|-------------|--------|
| 4 | `blobUrlTracker.ts` — extended with LRU eviction (cap 500) | Done |
| 5 | `fileStorage.ts` — integrated `globalBlobTracker.trackFromBlob()` | Done |
| 6 | `blobUrlTracker.test.ts` — extended from 4 to 10 tests | Done |

### Phase 3: SmartImage / SmartImg Components

| Step | Description | Status |
|------|-------------|--------|
| 7 | `SmartImage.tsx` — Next.js Image wrapper, shimmer skeleton, fade-in, error fallback | Done |
| 8 | `SmartImg.tsx` — raw img wrapper, shimmer skeleton, fade-in, lazy loading | Done |
| 9 | Tests — SmartImage (5 tests), SmartImg (6 tests) | Done |

### Phase 4: Component Migration

| Step | File | Changes |
|------|------|---------|
| 10 | `bible/page.tsx` | 2x Image → SmartImage |
| 11 | `InspectorView.tsx` | 3x Image → SmartImage |
| 12 | `production/page.tsx` | 3x Image → SmartImage |
| 13 | `StoryboardPanel.tsx`, `StoryboardShared.tsx`, `DirectorShotCard.tsx`, `EmbeddedTrackView.tsx`, `BasicShotCard.tsx`, `ImageEditOverlay.tsx` | 6x Image → SmartImage |
| 14 | `library/page.tsx` | 3x img → SmartImg |
| 15 | `ShotStudio.tsx` | 3x img → SmartImg |

### Phase 5: Preloading

| Step | Description | Status |
|------|-------------|--------|
| 16 | `useImagePreloader.ts` — cache warming hook (bounded Set, cap 200) | Done |

### Phase 6: Verification & Additional Fixes

| Step | Description | Status |
|------|-------------|--------|
| 17-18 | Tests, build, lint, audit | Done |

## Additional Fixes (pre-existing TypeScript errors)

| File | Issue | Fix |
|------|-------|-----|
| `piece/page.tsx` | `window` cast error | `as unknown as Record` |
| `StoryboardPanel.tsx` | `null` not assignable to `string \| undefined` | `?? undefined` |
| `ShotStudio.tsx` | Same as above (4 places) | `?? undefined` |
| `CommandBar.tsx` | `SpeechRecognition` type missing | Created `speech.d.ts` |
| `useHandTracking.ts` | Missing `close()`/`detectForVideo()` in type | Extended inline type |

## New Files Created

| File | Purpose |
|------|---------|
| `src/components/ui/SmartImage.tsx` | Next.js Image wrapper with shimmer + fade-in |
| `src/components/ui/SmartImg.tsx` | Raw img wrapper with shimmer + fade-in |
| `src/hooks/useImagePreloader.ts` | Browser cache warming hook |
| `src/lib/imageLoader.ts` | Custom Next.js image loader (passthrough) |
| `src/lib/__tests__/SmartImage.test.ts` | 5 tests |
| `src/lib/__tests__/SmartImg.test.ts` | 6 tests |
| `src/types/speech.d.ts` | Web Speech API type declarations |

## Verification Results

| Check | Result |
|-------|--------|
| Tests | 375/375 passed (26 files) |
| Build | Success, 21 pages generated |
| Lint | 0 errors, 0 warnings from changed files |
| Security | No hardcoded secrets |
| nginx (stage vs prod) | Identical `/img/` and `/storage/` configs |

## Remaining Work

### Non-critical — ~17 raw `<img>` in production code

| Category | Files | Action |
|----------|-------|--------|
| Production pages | StoryboardShared (2), screenplayRenderers (1), DirectorShotCard (1), ShotStudio (1), bible lightbox (1), library (1), ShotCard (1) | Migrate to SmartImg |
| Board nodes | ImageGenNode, ImageCardNode, PreviewNode, ShotNode | Keep as raw `<img>` (canvas performance) |
| Dev/experimental | BibleSidebar (3), BasicShotCard (1), PipelineShotCard (1), breakdown-studio (8) | Low priority |

### Future improvements

- BlurHash server-side generation for instant placeholders
- Virtual scrolling for Library grid (large collections)
- Staging gate token — move from hardcoded to env variable
