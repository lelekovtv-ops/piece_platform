# Work Session Report — April 9, 2026

## Session: Image Loading & Caching System — Research and Plan

### Summary

Completed comprehensive research and created a detailed implementation plan for smooth image loading UX across the KOZA platform. The plan addresses jarring visual experience where images "pop" into view without any loading transitions, plus 3 confirmed blob URL memory leaks.

### Work Completed

1. **Image component audit** — investigated ALL 20+ image-rendering instances across 6+ features (Bible, Library, Production, ShotStudio, InspectorView, ImageEditOverlay, LibraryPanel, ImageCardNode)
2. **Caching infrastructure analysis** — documented complete URL lifecycle (S3 publicUrl, Imagor presigned, blob: URLs, /storage/ direct), IndexedDB storage, blob URL management
3. **Memory leak identification** — found 3 confirmed blob URL leaks in timeline.ts, bible.ts, library.ts stores (loadBlob() creates NEW URL.createObjectURL() on every call, never revoked)
4. **Industry best practices research** — studied how Figma, Notion, Canva, Linear, Pinterest handle image loading (blur-up, LQIP, skeleton, progressive loading, opacity transitions)
5. **Next.js Image API research** — documented placeholder="blur", blurDataURL, custom loader, sizes, preload props available in Next.js 16
6. **Implementation plan created** — 18-step plan across 6 phases, saved to session memory and repo memory

### Key Findings

| Aspect | Current State |
|--------|---------------|
| Loading transitions | ZERO — no fade-in, no blur, no skeleton |
| `placeholder="blur"` | Not used anywhere |
| `loading="lazy"` | Only 2 out of 20+ images |
| `sizes` prop | Not used anywhere |
| Next.js Image config | Empty — no remotePatterns, no loader, no qualities |
| ImagorImage component | Defined but never used |
| Service Worker | None |
| Cache API | None |
| IntersectionObserver | None |
| Blob URL tracking | Partial — only ShotStudio, leaks in bible/library/timeline stores |

### Memory Leaks Identified

1. **LEAK #1 (HIGH)**: `bible.ts` — `restorePrimaryImage()` and `restoreReferenceImages()` create untracked blob URLs via `loadBlob()`, never revoked (up to 150 per character set)
2. **LEAK #2 (HIGH)**: `timeline.ts` — `onRehydrateStorage` replaces old blob URLs without revoking them, O(N) orphaned URLs per refresh
3. **LEAK #3 (MEDIUM)**: `library.ts` — `restoreAllBlobs()` creates blob URLs that persist until page reload

### Plan Created: Smooth Image Loading & Caching System

**18 steps across 6 phases:**

- **Phase 1** (Steps 1–4): Create SmartImage/SmartImg components with fade-in + shimmer skeleton + tests
- **Phase 2** (Steps 5–10): Migrate all 10+ components to use new wrappers
- **Phase 3** (Steps 11–13): Fix blob URL memory leaks with centralized blobUrlManager
- **Phase 4** (Steps 14–15): Configure Next.js Image optimization + custom Imagor loader
- **Phase 5** (Steps 16–17): Add useImagePreloader hook + viewport-aware lazy loading
- **Phase 6** (Step 18): Final audit — build + lint + tests + visual verification

### New Files Planned

| File | Purpose |
|------|---------|
| `apps/frontend/src/components/ui/SmartImage.tsx` | Unified Next.js Image wrapper with fade-in + skeleton |
| `apps/frontend/src/components/ui/SmartImg.tsx` | Unified raw img wrapper with fade-in + lazy |
| `apps/frontend/src/lib/blobUrlManager.ts` | Centralized blob URL lifecycle manager |
| `apps/frontend/src/hooks/useImagePreloader.ts` | Preloading hook |
| `apps/frontend/src/lib/imageLoader.ts` | Custom Imagor-aware image loader |

### Files to Modify

- `apps/frontend/next.config.ts` — add images config
- `apps/frontend/src/app/bible/page.tsx` — migrate to SmartImage
- `apps/frontend/src/app/library/page.tsx` — migrate to SmartImg
- `apps/frontend/src/app/production/page.tsx` — migrate to SmartImage
- `apps/frontend/src/components/editor/screenplay/views/InspectorView.tsx` — migrate
- `apps/frontend/src/components/editor/ShotStudio.tsx` — migrate
- `apps/frontend/src/store/timeline.ts` — fix blob URL leak
- `apps/frontend/src/store/bible.ts` — fix blob URL leak
- `apps/frontend/src/store/library.ts` — fix blob URL leak

### Decisions Made

- **SmartImage replaces ImagorImage** as universal wrapper (ImagorImage is currently unused)
- **Service Worker excluded** — browser HTTP cache sufficient for now
- **BlurHash generation** — follow-up task (generate 10px base64 thumbnails server-side)
- **Virtual scrolling** — separate plan for Library with 100+ images

### Artifacts

| Artifact | Location |
|----------|----------|
| Full plan | `/memories/session/plan.md` |
| Repo task brief | `/memories/repo/next-session-task.md` |
| Report | `docs/reports/2026-04-09-image-loading-plan.md` |

### Next Session

Pick up the plan from `/memories/repo/next-session-task.md` and start with Phase 1: create SmartImage + SmartImg components with TDD approach (tests first).
