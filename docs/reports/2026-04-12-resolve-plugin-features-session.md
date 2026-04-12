# Session Report — 2026-04-12: Resolve Plugin Features & Deployment

## Duration
~3 hours

## Summary

Major feature expansion of the PIECE Studio DaVinci Resolve plugin. Executed a 21-task plan adding generation queue, duration control, image references, and media library. Also added Resolve Media Pool integration, video preview, and deployed to staging.

## Commits

| Hash | Description |
|------|-------------|
| `181c053` | refactor(resolve-plugin): polish Electron providers, IPC handlers, and renderer components |
| `1cba27e` | feat(resolve-plugin): add generation queue, duration selector, image references, and media library |
| `7c91922` | feat(resolve-plugin): PIECE Generations folder in Media Pool, Resolve clip references, video preview |
| `3daa0e6` | docs: add PIECE Studio monetization and providers memo |
| `3980ed3` | fix(resolve-plugin): add Blob and FormData to eslint globals |

## Features Added

### 1. Generation Queue (Serial, max 10)
- **Files:** `queue-handlers.js`, `queue-store.ts`, `QueueList.tsx`
- Serial processing — one at a time, queued items wait
- IPC channels: add, list, cancel, clear, onUpdate (real-time to renderer)
- UI: queue list with status icons, cancel per item, clear pending

### 2. Duration Selector
- **Files:** `DurationInput.tsx`, `providers.ts`
- Slider with min/max/step for video models
- Grok: 3-15s (default 5), Sora2: 10-15s (default 10), Kling3: 3-15s (default 5)
- Shows only when selected provider has `durationRange`

### 3. Image References
- **Files:** `ReferenceSelector.tsx`, `upload.js`, `library-handlers.js`
- Three sources: From Library, From Resolve, Snapshot
- Upload local files to tmpfiles.org for URL (required by AI providers)
- Nano Banana: up to 8 refs, i2v providers (Veo3/Sora2/Grok/Kling3): 1 ref
- Auto-resolves local paths vs URLs before sending to provider

### 4. Media Library
- **Files:** `LibraryBar.tsx`, `LibraryGrid.tsx`, `library-store.ts`, `library-handlers.js`
- Persistent bottom bar (48px) in ExpandedPanel with horizontal thumbnail scroll
- Full grid overlay (3 columns) with file type badges and delete
- Scans `~/.piece-studio/downloads/` and `~/.piece-studio/uploads/`
- Library manifest (`library.json`) tracks metadata per file
- Video/audio preview player on click (autoplay, controls)

### 5. Resolve Media Pool Integration
- **Files:** `media-pool.js`, `index.js` (resolve handler)
- "PIECE Generations" folder auto-created in Media Pool
- All generated media imports into this folder (not root)
- `resolve:list-clips` IPC — walks entire Media Pool tree
- "From Resolve" button in ReferenceSelector — picks clips from Media Pool as refs

### 6. Provider Metadata Expansion
- **File:** `providers.ts`
- Added `ProviderDef` interface with optional `durationRange` and `maxReferences`
- 6 providers with duration, 10 providers with references

## Files Changed

- **New files:** 13 source + 3 test files
- **Modified files:** 12 source + 5 test files
- **Total:** 25+ files, ~1600 lines added

## Test Results

- **35/35** test files passing
- **263/263** tests passing
- Build passes (renderer + main + preload)
- Lint clean (after adding Blob/FormData globals)

## Deployment

- `dev` branch pushed to GitHub
- `stage` branch merged from dev and pushed — CI/CD triggered
- Lint fix deployed after initial CI failure (missing Blob/FormData globals)

## DaVinci Resolve Plugin Installation

Plugin requires physical copy (not symlink) to:
```
/Library/Application Support/Blackmagic Design/DaVinci Resolve/Workflow Integration Plugins/PIECE Studio
```

Command:
```bash
sudo rm -rf "<path>/PIECE Studio" && sudo cp -R /path/to/resolve-plugin "<path>/PIECE Studio"
```

**Important:** `WorkflowIntegration.node` must be present (copied from Resolve SDK examples). `"type": "module"` removed from package.json — Resolve expects CJS.

**Note:** Workflow Integrations menu requires DaVinci Resolve Studio (paid). Free version always shows it grayed out.

## Issues Encountered

1. **Symlink not followed by Resolve** — physical copy required
2. **`"type": "module"` in package.json** — broke CJS loading by Resolve's Electron, removed
3. **Missing `WorkflowIntegration.node`** — copied from Resolve SDK samples
4. **ESLint CI failure** — `Blob` and `FormData` not in globals, fixed

## Architecture Note

Plugin code lives on `dev` and `stage` branches. Not yet on `main` — the user's other Claude chat downloads from `main` and doesn't see the plugin code. To fix: either merge to `main` or download ZIP from `dev` branch.

## Next Steps

- Test plugin inside DaVinci Resolve Studio with actual generation
- Verify PIECE Generations folder creation in Media Pool
- Test From Resolve reference picker with real clips
- Consider moving `WorkflowIntegration.node` out of git (gitignore + install script)
