# PIECE Studio for DaVinci Resolve — Implementation Plan v2.0

**Created:** 2026-04-11
**Revised:** 2026-04-12 (v2.0 — 15 critical fixes applied after deep analysis)
**Scope:** New product `apps/resolve-plugin/` inside the PIECE monorepo. A commercial DaVinci Resolve Studio Workflow Integration plugin that provides a unified, polished AI generation panel (image, video, audio) with PIECE authentication and license validation.
**Timeline:** 10 working days (1 developer)
**Branch:** `dev` → feature branches per phase
**Owner:** Alex
**Status:** Ready for execution

---

## Context for Claude Code

This plan creates a NEW application inside the existing piece monorepo. The app is a **DaVinci Resolve Studio Workflow Integration plugin** — it runs INSIDE Resolve's own Electron/Node.js runtime (NOT as a standalone Electron app). Sold as **PIECE Studio** — a standalone commercial product that uses PIECE infrastructure (auth, encryption, logger, types) but does NOT depend on screenplay/rundown/timeline domain features. Those are reserved for v2.0.

### Critical runtime constraints

1. **No Electron dependency.** Resolve provides its own Electron runtime. The plugin is loaded INTO Resolve via `WorkflowIntegration.node`. Adding `electron` as a dep creates 200MB bloat and version conflicts. Electron APIs (`BrowserWindow`, `shell`, `ipcMain`) are available at runtime from Resolve's built-in Electron.
2. **No `app.setAsDefaultProtocolClient()`.** The `app` instance belongs to Resolve — the plugin cannot register custom URL schemes. Auth uses **Device Code Flow** (OAuth 2.0 RFC 8628) instead.
3. **The `.node` native module requires `createRequire`.** ESM cannot `import` native `.node` files. Use `createRequire(import.meta.url)` — this is NOT a violation of the "no require()" rule since it's the only way to load compiled C++ addons in ESM.
4. **`@piece/config` cannot work outside monorepo.** It walks up the directory tree looking for `pnpm-workspace.yaml` to find `.env`. An installed plugin has no monorepo. The plugin uses a **standalone config module** with fallback to a local config file.
5. **Source code is ESM, build output is CJS.** Resolve's Node.js runtime may not support ESM for plugins. Source is written as ESM (import/export), then bundled via esbuild into a single CJS file for maximum compatibility.

A working prototype exists in a separate folder (`com.bpmmedia.aigenerator`) with proven end-to-end functionality:

- WorkflowIntegration.node loads in Resolve Studio 20 on macOS
- Google Gemini 2.5 Flash Image text-to-image generation works (verified end-to-end)
- File downloads land in Media Pool and on the timeline
- Floating bubble UI works (alwaysOnTop, transparent, draggable)

**This plan rebuilds that prototype as a proper PIECE application** following all iron-laws and patterns, then extends it to a sellable v1.0 product.

The prototype code is reference-only — do NOT copy files verbatim. Rewrite each component to PIECE standards (ESM, English-only, Vitest TDD, kebab-case, max 800 lines per file, no console.log, no process.env, no require(), zero ESLint warnings).

---

## Iron Laws Reminder

Before any code is written, re-read `.claude/rules/iron-laws.md`. The following are NON-NEGOTIABLE for this plan:

1. NO production code without a failing test first (TDD)
2. NO completion claims without fresh verification evidence
3. NO console.log — use structured logger (Pino with file transport for Resolve context)
4. NO process.env directly — use plugin config module (NOT `@piece/config` — see constraint #4)
5. NO require() — ESM imports only (EXCEPTION: `createRequire` for `.node` native modules)
6. NO eslint-disable — fix the code
7. NO Cyrillic in source files, docs, or config — only in chat to user
8. NO file > 1000 lines, prefer < 800
9. NO bundling plan items — every plan sub-task = one tracked task
10. NO automatic push or deploy after completing a plan — only commit

---

## High-Level Architecture

```
piece_platform/
└── apps/
    └── resolve-plugin/
        ├── src/
        │   ├── main/                    # Node ESM (runs in Resolve's Node.js runtime)
        │   │   ├── index.js             # Entry point (Initialize + BrowserWindow)
        │   │   ├── config.js            # Standalone plugin config (NOT @piece/config)
        │   │   ├── logger.js            # Pino logger with file transport for Resolve
        │   │   ├── window/              # BrowserWindow + bubble lifecycle
        │   │   ├── ipc/                 # IPC handlers (renderer ↔ main)
        │   │   ├── auth/                # Device Code Flow + token storage
        │   │   │   ├── device-code.js   # Device Code Flow (RFC 8628)
        │   │   │   └── token-storage.js # Encrypted local token storage
        │   │   ├── license/             # License check via PIECE API
        │   │   ├── providers/           # AI provider adapters
        │   │   │   ├── google-gemini/
        │   │   │   ├── fal/
        │   │   │   ├── replicate/
        │   │   │   └── fish-audio/
        │   │   ├── resolve/             # WorkflowIntegration.node bindings
        │   │   │   ├── client.js        # GetResolve(), Initialize(), CleanUp()
        │   │   │   ├── media-pool.js    # ImportMedia, AppendToTimeline
        │   │   │   ├── snapshot.js      # GrabStill + ExportStills (two-step)
        │   │   │   └── timeline.js      # Timeline introspection (read-only v1)
        │   │   └── api-client/          # HTTP client to PIECE backend
        │   │
        │   ├── renderer/                # UI process (TypeScript + React 19)
        │   │   ├── index.html
        │   │   ├── main.tsx             # Entry point
        │   │   ├── App.tsx
        │   │   ├── components/
        │   │   │   ├── bubble/          # Floating bubble (collapsed mode)
        │   │   │   ├── expanded/        # Full UI (expanded mode)
        │   │   │   ├── auth/            # Device Code sign-in screen
        │   │   │   ├── generation/      # Image/Video/Audio panels
        │   │   │   └── shared/          # Buttons, inputs, design system
        │   │   ├── hooks/
        │   │   ├── stores/              # Zustand stores
        │   │   ├── styles/              # Tailwind v4 + design tokens
        │   │   └── types/               # Local renderer types
        │   │
        │   ├── shared/                  # Shared between main and renderer
        │   │   ├── ipc-channels.js      # IPC channel name constants
        │   │   └── plugin-id.js         # Plugin ID constant
        │   │
        │   └── installer/               # Build scripts
        │       ├── macos/
        │       │   ├── install.command
        │       │   └── uninstall.command
        │       └── windows/
        │           └── install.bat
        │
        ├── tests/
        │   ├── unit/                    # Vitest unit tests
        │   └── integration/             # Integration tests with mocked Resolve API
        │
        ├── manifest.xml                 # Resolve Workflow Integration manifest
        ├── package.json
        ├── tsconfig.json                # For renderer TypeScript
        ├── vite.config.ts               # Renderer bundling
        ├── esbuild.config.js            # Main process bundling (ESM → CJS)
        ├── eslint.config.js             # Flat ESLint config (NOT .eslintrc.cjs)
        ├── vitest.config.js
        └── README.md
```

### Key architectural decisions

- **Plugin runs INSIDE Resolve's Electron runtime.** It is NOT a standalone Electron app. `electron` is NOT a dependency. BrowserWindow, ipcMain, shell etc. are imported from Resolve's built-in Electron at runtime.
- **Main process source is JavaScript ESM, built to CJS.** Source uses `import`/`export` (PIECE convention). esbuild bundles into a single CJS file for Resolve compatibility. `createRequire(import.meta.url)` used only for the `.node` native module.
- **Renderer is TypeScript + React 19 + Tailwind v4** (matches PIECE frontend convention).
- **Vite bundles the renderer** into static HTML/JS/CSS that Resolve's BrowserWindow loads via `loadFile()`.
- **Auth uses Device Code Flow (RFC 8628)** — plugin shows a user code, user enters it at `{PIECE_URL}/device` in their browser. No custom URL schemes needed.
- **Standalone config module** loads from `~/.piece-studio/config.json` (installed) or from monorepo `.env` (development). Does NOT use `@piece/config` (which requires monorepo root).
- **Logger uses Pino with file transport.** Resolve's stdout may not be visible. Logs write to `~/.piece-studio/logs/`. In development, also logs to stdout.
- **All shared types live in `@piece/domain-types`** in the monorepo. No local type duplication.
- **HTTP client to PIECE backend** uses `fetch` (Node built-in) with Bearer token from secure local storage.
- **Provider adapters follow a strict interface** so adding new providers is mechanical:
  ```javascript
  // Each provider exports:
  export const provider = {
    id: "image:google-gemini-flash",
    kind: "image" | "video" | "audio",
    keyField: "key_google",
    label: "Google Gemini 2.5 Flash Image",
    async generate(input, apiKey, options) {
      // Returns { kind: 'bytes' | 'url', value, suffix }
    },
  };
  ```
- **License check is mandatory at startup**. If license invalid → renderer shows upgrade screen and provider buttons are disabled. No license = no generations.
- **Auth tokens stored encrypted** via `@piece/encryption` (AES-256-GCM) in `~/.piece-studio/auth.enc` on macOS, `%APPDATA%\PIECE Studio\auth.enc` on Windows.
- **Encryption key derived from `crypto.randomBytes`** stored in `~/.piece-studio/.keyfile` (created on first run). NOT from `node-machine-id` (avoids native compilation issues in Resolve's runtime).

---

## Backend Changes Required (PIECE side)

These backend changes must be done BEFORE the plugin can authenticate. They are small and self-contained.

### B.1 Device Code Flow endpoints [M]

Implements OAuth 2.0 Device Authorization Grant (RFC 8628) for desktop app authentication.

CREATE `POST /v1/auth/device-code` (public, rate limited: 10 req/60s):

Behavior:

- Generates a `device_code` (opaque, 64 hex chars via `crypto.randomBytes(32)`).
- Generates a `user_code` (human-readable, 8 chars: `XXXX-XXXX`, uppercase alphanumeric, no ambiguous chars like 0/O/I/L).
- Stores in `device_codes` collection: `{ deviceCode, userCodeHash: SHA256(userCode), appId, status: 'pending', createdAt, expiresAt (10 min), userId: null }`.
- Returns: `{ deviceCode, userCode, verificationUri: '{PIECE_URL}/device', expiresIn: 600, interval: 5 }`.

CREATE `POST /v1/auth/device-code/poll` (public, rate limited: 20 req/60s):

Behavior:

- Accepts `{ deviceCode }`.
- Looks up in `device_codes` collection.
- If `status === 'pending'`: return `{ error: 'authorization_pending' }` (HTTP 200).
- If `status === 'approved'`: generate desktop token (90-day, stored hashed in `desktop_tokens`), delete device_code record, return `{ accessToken, user: { id, email, name }, expiresAt }`.
- If `status === 'expired'` or record not found: return `{ error: 'expired_token' }` (HTTP 400).
- If caller polls faster than `interval`: return `{ error: 'slow_down' }` (HTTP 400).

CREATE `POST /v1/auth/device-code/verify` (protected, requires authenticated JWT):

Behavior:

- Accepts `{ userCode }`.
- Hashes userCode, looks up in `device_codes` by `userCodeHash` where `status === 'pending'`.
- If found and not expired: sets `status: 'approved'`, `userId: req.user.id`.
- Returns `{ appId, approved: true }`.
- If not found: return 404 `{ error: 'INVALID_CODE' }`.

CREATE middleware `authenticateDesktopToken` in `@piece/auth-middleware` that:

- Reads `Authorization: Bearer <token>` header.
- Hashes token, looks up in `desktop_tokens` collection.
- Validates not revoked, not expired.
- Updates `lastUsedAt` (fire-and-forget).
- Attaches `req.user` like `authenticateToken` does.
- Returns 401 with `{ error: 'INVALID_DESKTOP_TOKEN' }` on failure.

ADD list/revoke endpoints (protected, requires JWT):

- `GET /v1/auth/desktop-tokens` — list user's active desktop tokens with deviceInfo.
- `DELETE /v1/auth/desktop-tokens/:tokenId` — revoke specific token.

**Files:**

- `apps/backend/piece/src/modules/auth/device-code-service.js` (new)
- `apps/backend/piece/src/modules/auth/device-code-controller.js` (new)
- `apps/backend/piece/src/modules/auth/device-code-routes.js` (new)
- `apps/backend/piece/src/modules/auth/desktop-token-service.js` (new)
- `apps/backend/piece/src/db/initialize-system-indexes.js` (add device_codes + desktop_tokens indexes)
- `packages/auth-middleware/src/desktop-token.js` (new middleware)
- `apps/backend/piece/src/modules/auth/__tests__/device-code.test.js` (TDD)
- `apps/backend/piece/src/modules/auth/__tests__/desktop-token.test.js` (TDD)

**Verify:**

- `pnpm test` passes for device-code and desktop-token tests.
- Request device code → returns user_code + device_code.
- Poll with device_code before approval → `authorization_pending`.
- Verify user_code via authenticated endpoint → status becomes `approved`.
- Poll again → returns desktop access token.
- Use desktop token on protected endpoint → authenticated.
- Revoke desktop token → subsequent request returns 401.

### B.2 Device Code frontend page [M]

CREATE `/device` route in `apps/frontend/src/app/`.

Flow:

1. Page loads at `/device`. Shows centered card with input field for user code (auto-formatted as `XXXX-XXXX`).
2. If user not logged in: redirect to `/login?redirect=/device`.
3. If user logged in: show "Enter the code shown in PIECE Studio" with input field.
4. On submit: POST to `/v1/auth/device-code/verify` with current JWT and the entered code.
5. On success: show green checkmark — "Device authorized! You can return to DaVinci Resolve."
6. On error: show red message — "Invalid or expired code. Please try again."

ADD `/device` to public routes list in `apps/frontend/src/lib/auth/public-routes.ts`.

**Files:**

- `apps/frontend/src/app/(main)/device/page.tsx` (new)
- `apps/frontend/src/app/(main)/device/components/DeviceCodeCard.tsx` (new)
- `apps/frontend/src/lib/api/device-auth.ts` (new — API client functions)
- `apps/frontend/src/lib/auth/public-routes.ts` (add `/device`)

**Verify:**

- Visit `/device` while logged in → see code input.
- Enter valid code → device authorized confirmation shown.
- Enter invalid code → error shown.
- Visit while logged out → redirected to login, then back to `/device`.

### B.3 Product licenses concept [S]

CREATE system-wide `licenses` collection in MongoDB (via `getGlobalSystemCollection('licenses')`).

Schema:

```javascript
{
  userId: ObjectId,
  productId: "piece-studio", // string identifier
  tier: "free" | "pro",
  status: "active" | "expired" | "revoked",
  source: "manual" | "lemon-squeezy" | "paddle" | "stripe",
  externalId: String, // external billing reference
  activatedAt: Date,
  expiresAt: Date, // null for lifetime
  createdAt: Date,
  updatedAt: Date,
}
```

CREATE endpoint `GET /v1/me/licenses`:

- Returns user's licenses (active only by default).
- Used by both web frontend (to gate features) and resolve-plugin (to gate access).
- Desktop token auth also accepted (so plugin can check license).

CREATE admin endpoints for manual license management (used by Alex to manually grant licenses to first customers):

- `POST /admin/users/:userId/licenses` — grant license.
- `DELETE /admin/users/:userId/licenses/:licenseId` — revoke license.

**Files:**

- `apps/backend/piece/src/modules/users/license-service.js` (new)
- `apps/backend/piece/src/modules/users/license-controller.js` (new)
- `apps/backend/piece/src/modules/users/license-routes.js` (new)
- `apps/backend/piece/src/modules/users/__tests__/license.test.js` (TDD)
- `packages/domain-types/src/license.js` (new shared type — JS not TS, matches domain-types convention)

**Verify:**

- `pnpm test` passes for license tests.
- Grant license via admin API → user has it.
- `GET /v1/me/licenses` returns it.
- Revoke license → no longer in active list.

### B.4 ESLint, build, tests green [S]

After B.1–B.3:

- `pnpm run lint` → 0 errors, 0 warnings
- `pnpm run build` → exit 0
- `pnpm test` → all pass including new tests
- All new code follows existing PIECE patterns (no `console.log`, no `require()`, no `process.env` direct, no `success: false` errors)

---

## Plugin Implementation Phases

### Phase 1: Scaffolding (Days 1–2)

**Goal:** Working `apps/resolve-plugin/` skeleton that builds, lints, and loads inside Resolve as a Workflow Integration plugin.

#### 1.1 Create app directory and package.json [S]

CREATE `apps/resolve-plugin/` with `package.json`:

```json
{
  "name": "@piece/resolve-plugin",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/main/index.cjs",
  "scripts": {
    "dev": "pnpm run build && pnpm run link:dev",
    "dev:renderer": "vite --config vite.config.ts",
    "build": "vite build && pnpm run build:main",
    "build:main": "node esbuild.config.js",
    "link:dev": "node scripts/link-to-resolve.js",
    "lint": "eslint src tests --max-warnings 0",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@piece/encryption": "*",
    "@piece/domain-types": "*",
    "pino": "^9.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "esbuild": "^0.24.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^3.0.0"
  }
}
```

**Key differences from original plan:**

- NO `electron` dependency (Resolve provides its Electron runtime)
- NO `@piece/config` dependency (cannot find monorepo root when installed)
- NO `@piece/logger` dependency (uses local Pino with file transport instead)
- NO `concurrently` (dev workflow is build → symlink → restart Resolve)
- `main` points to `dist/main/index.cjs` (build output, NOT source)
- esbuild for main process bundling (ESM source → CJS output)

REGISTER `apps/resolve-plugin` in `pnpm-workspace.yaml` — **it currently only has `apps/backend/*` and `apps/frontend`, NOT `apps/*`**. Must explicitly add `apps/resolve-plugin`.

**Verify:** `pnpm install` succeeds, no errors.

#### 1.2 Register in pnpm-workspace.yaml [S]

EDIT `pnpm-workspace.yaml` to add `apps/resolve-plugin`:

```yaml
packages:
  - "packages/*"
  - "apps/backend/*"
  - "apps/frontend"
  - "apps/resolve-plugin"
  - "tools/*"
```

**Verify:** `pnpm install` resolves workspace dependencies correctly.

#### 1.3 TypeScript config for renderer [S]

CREATE `apps/resolve-plugin/tsconfig.json` matching frontend conventions (strict mode, ESNext target, react-jsx, paths).

**Verify:** `tsc --noEmit` exits 0 on empty src.

#### 1.4 Vite config for renderer [S]

CREATE `apps/resolve-plugin/vite.config.ts`:

- React plugin
- Output to `dist/renderer/`
- Base path: `./` (for Resolve's BrowserWindow loadFile)
- Build target: `chrome120` (Resolve Studio 20's Electron ships ~Chromium 128)

**Verify:** `pnpm run dev:renderer` starts Vite dev server.

#### 1.5 esbuild config for main process [S]

CREATE `apps/resolve-plugin/esbuild.config.js`:

- Entry: `src/main/index.js`
- Output: `dist/main/index.cjs` (CommonJS format for Resolve compatibility)
- Platform: `node`
- Bundle: true (single file output)
- External: `['electron', 'WorkflowIntegration']` (provided by Resolve at runtime)
- Source maps: true (for debugging)

**Verify:** `pnpm run build:main` produces `dist/main/index.cjs`.

#### 1.6 ESLint flat config [S]

CREATE `apps/resolve-plugin/eslint.config.js` using **flat config format** (NOT `.eslintrc.cjs` — matches project convention). Add rules for React and TypeScript in renderer.

**Verify:** `pnpm run lint` exits 0 on empty src.

#### 1.7 Vitest config [S]

CREATE `apps/resolve-plugin/vitest.config.js` extending `vitest.shared.js` from root.

**Verify:** `pnpm test` exits 0 (no tests yet, but config valid).

#### 1.8 Plugin manifest.xml [S]

CREATE `apps/resolve-plugin/manifest.xml` with PIECE Studio identification:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<BlackmagicDesign>
    <Plugin>
        <Id>app.piece.studio</Id>
        <Name>PIECE Studio</Name>
        <Version>1.0.0</Version>
        <Description>AI generation suite for DaVinci Resolve. Image, video, and audio generation through your favorite AI providers.</Description>
        <FilePath>dist/main/index.cjs</FilePath>
    </Plugin>
</BlackmagicDesign>
```

**Note:** `FilePath` points to the **build output** (`dist/main/index.cjs`), NOT the source. Resolve loads this file directly.

**Verify:** `xmllint --noout manifest.xml` succeeds.

#### 1.9 Standalone plugin config module [M] [TDD]

CREATE failing test first: `tests/unit/main/config.test.js`.

CREATE `src/main/config.js` — **standalone config module** (NOT `@piece/config`):

- Loads from `~/.piece-studio/config.json` if it exists (production/installed path)
- Falls back to environment variables (dev mode, when running inside monorepo)
- Required keys: `PIECE_API_URL`, `LOG_LEVEL`
- Plugin-specific config: `dataDir` (~/.piece-studio/), `downloadDir`, `snapshotDir`, `logDir`
- Uses `os.homedir()` for cross-platform paths
- Validates required fields, provides sensible defaults
- `get(key)` method for accessing config values
- NO dependency on `@piece/config`, NO monorepo root detection

**Verify:** Tests pass.

#### 1.10 Plugin logger with file transport [S] [TDD]

CREATE failing test for `src/main/logger.js`.

CREATE `src/main/logger.js`:

- Creates Pino logger instance directly (NOT via `@piece/logger` — avoids monorepo dependency)
- **File transport:** Writes to `~/.piece-studio/logs/piece-studio-{date}.log`
- **Stdout transport:** Also writes to stdout (visible in dev, may not be visible in Resolve production)
- Log rotation: new file per day
- Exports `createComponentLogger(name)` for scoped logging
- JSON structured format matching PIECE logger output

**Verify:** Tests pass. Log file created in expected location.

#### 1.11 Minimal main process entry point [M] [TDD]

CREATE failing test: `tests/unit/main/index.test.js` that imports the entry point and asserts it exports an `init` function.

CREATE `src/main/index.js`:

- Import config FIRST
- Import logger SECOND
- Create logger with component name 'ResolvePlugin'
- Load WorkflowIntegration.node via `createRequire(import.meta.url)` (best-effort, graceful null on failure)
- Call `WorkflowIntegration.Initialize(pluginId)` to register with Resolve
- Import `BrowserWindow` from `electron` (Resolve's built-in — NOT a dependency)
- Create BrowserWindow, load built renderer
- Register process error handlers (unhandledRejection, uncaughtException)
- On app exit: call `WorkflowIntegration.CleanUp()`
- NO console.log anywhere

**Verify:**

- `pnpm test` passes (test from TDD step now passes).
- `pnpm run build` succeeds (both renderer and main).
- Logs appear in `~/.piece-studio/logs/` as JSON.

#### 1.12 Dev workflow: build + symlink to Resolve [S]

CREATE `scripts/link-to-resolve.js`:

- Detects OS (macOS / Windows)
- macOS target: `~/Library/Application Support/Blackmagic Design/DaVinci Resolve/Workflow Integration Plugins/PIECE Studio/`
- Creates **symbolic link** from target to `apps/resolve-plugin/` (NOT copy)
- In dev mode, symlink means code changes are reflected after rebuild + Resolve restart
- If target exists and is not a symlink, warns and exits (don't overwrite real installs)

**Verify:**

- Run `pnpm run link:dev` → symlink created
- Open Resolve → Workspace → Workflow Integrations → PIECE Studio appears
- After `pnpm run build` + Resolve restart → updated code loads

#### 1.13 Minimal renderer with Tailwind [S]

CREATE `src/renderer/main.tsx`, `src/renderer/App.tsx` with placeholder "PIECE Studio loading..." text styled via Tailwind v4.

CREATE `src/renderer/index.html` that Vite uses as entry.

CREATE `src/renderer/styles/global.css` with `@import "tailwindcss";`.

**Verify:**

- `pnpm run dev:renderer` shows the placeholder in browser.
- `pnpm run build` produces `dist/renderer/index.html`.

#### 1.14 Phase 1 verification [GATE]

```bash
cd apps/resolve-plugin
pnpm install                  # exit 0
pnpm run lint                 # exit 0, zero warnings
pnpm test                     # all pass
pnpm run build                # exit 0, dist/ created with dist/main/index.cjs + dist/renderer/
pnpm run link:dev             # symlink created to Resolve plugins folder
# Restart Resolve → PIECE Studio appears in Workflow Integrations menu
```

COMMIT: `feat(resolve-plugin): scaffold app inside monorepo`

DO NOT push or deploy. Move to Phase 2.

---

### Phase 2: Resolve API bindings (Days 3–4)

**Goal:** Plugin can talk to DaVinci Resolve through `WorkflowIntegration.node`. All Resolve interactions are isolated in `src/main/resolve/` with mockable interface.

#### 2.1 Resolve client wrapper [M] [TDD]

CREATE failing test `tests/unit/main/resolve/client.test.js`:

- Mock `WorkflowIntegration.node` module
- Test `initialize(pluginId)` calls `Initialize` and stores resolve object
- Test `getResolve()` returns initialized object
- Test `cleanup()` calls `CleanUp`
- Test fails gracefully when native module is absent (returns null, logs warning)

CREATE `src/main/resolve/client.js`:

- ESM module
- Load `WorkflowIntegration.node` using `createRequire(import.meta.url)` — this is the ONLY place `require` is used, necessary for native `.node` addon loading in ESM
- Look up paths: standard Sample Plugin location on macOS and Windows
- Export `initialize(pluginId): boolean`, `getResolve(): ResolveAPI | null`, `cleanup(): void`
- Use plugin logger (from `src/main/logger.js`) for all messages

**Verify:** All tests pass. Manual test on real Mac with Resolve installed: log shows "Resolve API initialized".

#### 2.2 Media pool operations [M] [TDD]

CREATE failing tests for `src/main/resolve/media-pool.js`:

- `importMedia(filePath)` returns array of MediaPoolItem
- `appendToTimeline(item, options)` returns array of TimelineItem
- `getCurrentTimeline()` returns timeline or null
- All functions throw with structured errors when Resolve not initialized

CREATE `src/main/resolve/media-pool.js` implementing the above. Mirror functionality from prototype `main.js` `insertClipToTimeline()` but split into testable units.

Key requirements (from official Resolve API docs):

- Use `MediaPool.ImportMedia([filePath])` (array argument)
- Use `MediaPool.AppendToTimeline([{mediaPoolItem, startFrame, endFrame, mediaType}])` — **NOTE: correct signature is `startFrame`/`endFrame`, NOT `trackIndex`/`recordFrame`** (verified against official docs)
- To place at playhead: read `Timeline.GetCurrentTimecode()`, convert to frame number
- `mediaType` is optional (1 = Video, 2 = Audio)

**Verify:** All unit tests pass. Manual test on real Mac: import a test PNG → appears in Media Pool → appears on timeline at playhead.

#### 2.3 Snapshot frame [S] [TDD]

CREATE failing test for `src/main/resolve/snapshot.js`:

- `snapshotCurrentFrame(outputDir)` returns path to created file
- Throws when project/timeline not available

CREATE `src/main/resolve/snapshot.js`:

**Two-step approach** (because `Project.ExportCurrentFrameAsStill()` is NOT in the official JS Scripting API):

1. Call `Timeline.GrabStill()` — adds still to the current gallery album
2. Get the gallery album via `Project.GetGallery().GetCurrentStillAlbum()`
3. Call `album.ExportStills([still], outputDir, filePrefix, format)` to export
4. Parse the exported filename and return absolute path
5. **Fallback:** If GrabStill fails (known issue in some JS API versions), use Resolve's render-in-place to export a single frame

- Generate unique filenames with timestamps
- Verify file exists after export
- Return absolute path

**Verify:** Tests pass. Manual test on real Mac: position playhead on a clip → call snapshot → file created in target directory → readable.

#### 2.4 Phase 2 verification [GATE]

```bash
pnpm run lint        # exit 0
pnpm test            # all pass
```

Manual end-to-end on Mac with Resolve open:

1. Plugin initializes Resolve API.
2. Drop a test PNG into Media Pool via plugin code.
3. PNG appears on timeline.
4. Snapshot current frame.
5. File created in `~/.piece-studio/snapshots/`.

COMMIT: `feat(resolve-plugin): resolve api bindings with tests`

---

### Phase 3: Provider adapters (Days 5–6)

**Goal:** All AI providers from prototype, rewritten as testable adapters with a unified interface.

#### 3.1 Provider interface and registry [S] [TDD]

CREATE failing test for `src/main/providers/registry.js`:

- `registerProvider(provider)` adds to internal map
- `getProvider(id)` returns registered provider or undefined
- `listProviders(kind?)` filters by kind
- Throws on duplicate registration

CREATE `src/main/providers/types.js` (JSDoc typedefs for provider shape, since main is JS not TS).

CREATE `src/main/providers/registry.js` with the registry.

**Verify:** Tests pass.

#### 3.2 HTTP utilities [S] [TDD]

CREATE failing test for `src/main/utils/http.js`:

- `httpRequest(method, url, headers, body, timeoutMs)` returns `{statusCode, headers, body}`
- Handles HTTP and HTTPS
- Times out correctly
- Throws on non-2xx responses with structured error

CREATE `src/main/utils/http.js`. Use Node 22 built-in `fetch` instead of manual `https` module — cleaner, supports timeouts via AbortController, returns structured responses.

**Verify:** Tests pass. Mock `fetch` in tests using `vi.stubGlobal('fetch', vi.fn())` — NOT `vi.mock('node:undici')` (built-in fetch is a global, not a module).

#### 3.3 Google Gemini provider [M] [TDD]

CREATE failing test for `src/main/providers/google-gemini/image-flash.js`:

- Mock fetch to return base64 image response
- Provider returns `{kind: 'bytes', value: Buffer, suffix: '.png'}`
- Handles missing image in response (returns descriptive error)
- Supports image-to-image with reference image

CREATE `src/main/providers/google-gemini/image-flash.js`:

- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent`
- Auth: `x-goog-api-key` header
- Payload: text + optional inlineData reference image
- Decode base64 from `candidates[0].content.parts[].inlineData.data`

CREATE `src/main/providers/google-gemini/index.js` exporting all Google providers.

**Verify:** Tests pass. Manual test with real API key: generates a real image.

#### 3.4 fal.ai providers [M] [TDD]

CREATE `src/main/providers/fal/queue-runner.js`:

- Generic helper that submits to fal queue, polls status, fetches result
- Used by all fal providers

CREATE failing tests for each provider, then implementations:

- `src/main/providers/fal/flux-schnell.js` (image)
- `src/main/providers/fal/flux-pro.js` (image)
- `src/main/providers/fal/kling-v2.js` (video)
- `src/main/providers/fal/veo3.js` (video)
- `src/main/providers/fal/luma.js` (video)
- `src/main/providers/fal/elevenlabs.js` (audio TTS)
- `src/main/providers/fal/stable-audio.js` (audio music/SFX)

Each provider has its own file (kept under 100 lines each) and unit test that mocks the queue runner.

**Verify:** All tests pass.

#### 3.5 Replicate provider [S] [TDD]

CREATE `src/main/providers/replicate/runner.js` for Replicate's prediction API.
CREATE `src/main/providers/replicate/flux-schnell.js`.

**Verify:** Tests pass.

#### 3.6 Fish Audio provider [S] [TDD]

CREATE `src/main/providers/fish-audio/tts.js`.

**Verify:** Tests pass.

#### 3.7 Provider bootstrap [S]

CREATE `src/main/providers/index.js` that imports all providers and registers them with the registry on module load.

**Verify:**

- Importing this module registers all providers.
- `listProviders('image')` returns all image providers.
- `listProviders('video')` returns all video providers.
- `listProviders('audio')` returns all audio providers.

#### 3.8 Phase 3 verification [GATE]

```bash
pnpm run lint        # exit 0
pnpm test            # all pass — providers fully tested with mocked HTTP
```

COMMIT: `feat(resolve-plugin): provider adapters with unified interface`

---

### Phase 4: Auth flow — Device Code Flow (Days 7–8)

**Goal:** User can sign in to PIECE through the Device Code Flow (RFC 8628). Token stored encrypted. Plugin uses token for API calls. No custom URL schemes needed (impossible inside Resolve's app context).

#### 4.1 Token storage with encryption [M] [TDD]

CREATE failing test for `src/main/auth/token-storage.js`:

- `saveToken(token, metadata)` encrypts and writes to file
- `loadToken()` reads, decrypts, returns `{token, metadata}` or null
- `clearToken()` deletes the file
- Encryption key stored in `~/.piece-studio/.keyfile` (created on first run via `crypto.randomBytes(32)`)
- File path: `~/.piece-studio/auth.enc` (mac), `%APPDATA%\PIECE Studio\auth.enc` (win)

CREATE `src/main/auth/token-storage.js`:

- Use `@piece/encryption` for AES-256-GCM encryption
- Encryption key: read from `~/.piece-studio/.keyfile`. If missing, generate via `crypto.randomBytes(32).toString('hex')` and save to `.keyfile` with `0600` permissions.
- **NO `node-machine-id` dependency** — avoids native compilation issues in Resolve's runtime. Random key + secure file permissions provides equivalent security.
- Atomic file writes (temp file + rename)
- Return null gracefully on missing/corrupted file

**Verify:** Tests pass. Save token → load → matches. Clear → load returns null.

#### 4.2 Device Code Flow controller [M] [TDD]

CREATE failing test for `src/main/auth/device-code.js`:

- `startSignIn()` requests device code from backend, returns `{ userCode, verificationUri, expiresIn }`
- `pollForToken(deviceCode, interval)` polls backend until approved or expired
- `stopPolling()` cancels in-progress polling
- `signOut()` revokes token via API, clears local storage
- `getCurrentUser()` returns cached user info or null

CREATE `src/main/auth/device-code.js`:

- `startSignIn()`:
  1. Calls `POST /v1/auth/device-code` (no auth required)
  2. Returns `{ userCode, deviceCode, verificationUri, expiresIn, interval }`
  3. Opens browser to `verificationUri` via Electron's `shell.openExternal()` (Resolve provides this)
  4. Starts polling via `pollForToken()`
- `pollForToken(deviceCode, intervalSec)`:
  1. Every `intervalSec` (default 5s): calls `POST /v1/auth/device-code/poll` with `deviceCode`
  2. If `authorization_pending`: continue polling
  3. If `slow_down`: increase interval by 5 seconds
  4. If success: saves token via token-storage, fetches user info via `GET /v1/auth/me`
  5. If `expired_token` or total timeout: emit `auth-error`
  6. Returns `{ token, user }` on success
- `signOut()`: revokes desktop token, clears local storage, emits `auth-cleared`

**Verify:** Tests pass with mocked fetch.

#### 4.3 PIECE API client [M] [TDD]

CREATE failing test for `src/main/api-client/piece-client.js`:

- `getMe()` calls GET /v1/auth/me with stored desktop token
- `getMyLicenses()` calls GET /v1/me/licenses
- `revokeDesktopToken(token)` calls DELETE on the token
- `requestDeviceCode()` calls POST /v1/auth/device-code
- `pollDeviceCode(deviceCode)` calls POST /v1/auth/device-code/poll
- 401 responses trigger token clear and emit `auth-required` event

CREATE `src/main/api-client/piece-client.js`:

- Wraps fetch with auth header injection (`Authorization: Bearer <desktopToken>`)
- Centralized error handling
- Configurable base URL via plugin config (`src/main/config.js`)

**Verify:** Tests pass with mocked fetch.

#### 4.4 IPC handlers for auth [S] [TDD]

CREATE failing test for IPC handlers:

- `auth:start-signin` triggers device-code flow, returns `{ userCode, verificationUri }`
- `auth:get-current-user` returns user info
- `auth:sign-out` clears state
- `auth:on-status-change` emits when auth status changes

CREATE `src/main/ipc/auth-handlers.js`. Register on plugin init.

ADD typed channel constants in `src/shared/ipc-channels.js`:

```javascript
export const AUTH_CHANNELS = {
  startSignIn: "auth:start-signin",
  getCurrentUser: "auth:get-current-user",
  signOut: "auth:sign-out",
  onAuthStatusChange: "auth:on-status-change",
  onDeviceCode: "auth:on-device-code",
};
```

CREATE `src/main/preload.js` exposing `window.api.auth.*` via contextBridge.

**Verify:** Tests pass.

#### 4.5 Auth UI in renderer — Device Code Screen [M] [TDD]

CREATE failing component test for `DeviceCodeScreen.tsx`:

- Renders "Sign in to PIECE" header
- On mount or click "Sign in": shows spinner while requesting code
- Displays user code prominently (e.g., "ABCD-1234" in large monospace font)
- Shows instruction: "Go to {verificationUri} and enter this code"
- Shows "Open Browser" button that triggers `shell.openExternal`
- Shows countdown timer until code expires
- Shows success state when polling completes
- Shows error with retry button on failure/expiry

CREATE `src/renderer/components/auth/DeviceCodeScreen.tsx` with the above.

CREATE `src/renderer/stores/auth-store.ts` (Zustand):

- State: `user | null`, `status: 'checking' | 'unauthenticated' | 'awaiting-code' | 'authenticated' | 'error'`, `userCode: string | null`, `verificationUri: string | null`, `expiresAt: number | null`
- Actions: `signIn`, `signOut`, `setUser`, `setError`, `setDeviceCode`
- Subscribes to IPC events from main

**Verify:** Component tests pass.

#### 4.6 Phase 4 verification [GATE]

End-to-end manual test:

1. Launch plugin first time → device code screen appears.
2. Click "Sign in" → plugin requests device code from PIECE backend.
3. Screen shows: **"ABCD-1234"** — "Go to piece.app/device and enter this code"
4. Click "Open Browser" → system browser opens to `/device`.
5. In browser: log in to PIECE (if not already), enter the code.
6. Plugin polling detects approval → receives desktop token → fetches user info.
7. Screen transitions to authenticated UI showing user name/email.
8. Restart Resolve → plugin auto-loads, reads encrypted token, shows authenticated UI.
9. Click "Sign out" → token revoked, device code screen reappears.

```bash
pnpm run lint        # exit 0
pnpm test            # all pass
```

COMMIT: `feat(resolve-plugin): device code auth flow with piece backend`

---

### Phase 5: License gating (Day 9)

**Goal:** Plugin checks for valid PIECE Studio license. Without license, generation buttons are disabled and upgrade screen is shown.

#### 5.1 License check service [M] [TDD]

CREATE failing test for `src/main/license/license-check.js`:

- `checkLicense()` calls API, returns `{hasLicense, tier, expiresAt}`
- Caches result for 1 hour
- Forced refresh available
- Handles offline gracefully (returns last known state with `stale: true`)

CREATE `src/main/license/license-check.js`:

- Uses piece-client.getMyLicenses()
- Filters for productId === 'piece-studio' and status === 'active'
- Caches in memory + persists last known state to disk
- Logs license events

**Verify:** Tests pass.

#### 5.2 License IPC and store [S] [TDD]

CREATE IPC handlers `license:check`, `license:on-status-change`.

CREATE `src/renderer/stores/license-store.ts` with `hasLicense`, `tier`, `expiresAt`, `loading` state.

**Verify:** Tests pass.

#### 5.3 Upgrade screen UI [M]

CREATE `src/renderer/components/auth/UpgradeScreen.tsx`:

- Shown when authenticated but no license
- Displays "PIECE Studio Pro" pitch
- Lists features (image/video/audio generation, BYOK, no subscription, etc.)
- "Get License" button opens browser to PIECE pricing page (URL from config)
- "Refresh License" button re-checks (for after manual purchase)

**Verify:** Manual: when user has no license, this screen shows. Click refresh → re-checks.

#### 5.4 License gating throughout app [M]

Generation buttons in renderer check `useLicenseStore().hasLicense` and:

- If no license → button disabled with tooltip "PIECE Studio Pro license required"
- If license → button enabled

Generation IPC handler in main process also checks license server-side (defense in depth) before calling provider.

**Verify:** Without license, generation buttons disabled. With license (manually granted via admin API), generation works.

#### 5.5 Phase 5 verification [GATE]

```bash
pnpm run lint        # exit 0
pnpm test            # all pass
```

End-to-end:

1. Sign in as user without license → see upgrade screen.
2. Admin grants license via PIECE backend.
3. Click "Refresh License" in plugin → license detected → main UI accessible.
4. Generation works.
5. Admin revokes license → plugin re-checks within an hour OR on app restart → upgrade screen returns.

COMMIT: `feat(resolve-plugin): license gating via piece backend`

---

### Phase 6: UI port and polish (Day 10)

**Goal:** Floating bubble UI from prototype, rewritten in React 19 + TypeScript + Tailwind v4, integrated with auth and license gating. All window creation uses Resolve's built-in BrowserWindow (imported from `electron` at runtime — NOT as a dependency).

#### 6.1 Floating bubble window [M]

CREATE `src/main/window/bubble-window.js`:

- Import `{ BrowserWindow }` from `electron` — this resolves at runtime from Resolve's built-in Electron, NOT from a local dependency
- BrowserWindow config: 80x80, transparent, frame:false, alwaysOnTop, skipTaskbar
- `setVisibleOnAllWorkspaces(true, {visibleOnFullScreen: true})`
- `setAlwaysOnTop(true, 'floating')`
- Loads built renderer `dist/renderer/index.html` via `loadFile()` (NOT `loadURL` — no dev server in Resolve context)
- Saves window position to `~/.piece-studio/window-state.json`

CREATE `src/main/window/window-manager.js`:

- `createWindow()`, `expandWindow()`, `collapseWindow()`, `hideTemporarily()`, `showAgain()`
- IPC handlers: `window:expand`, `window:collapse`, `window:hide-temporarily`, `window:show-again`
- Position migration logic (reset position on version bump)
- For expanded mode: resize BrowserWindow to larger dimensions (e.g., 400x600)
- For bubble mode: resize back to 80x80

**Verify:** Manual on Mac in Resolve: bubble appears at saved position, can be dragged, position persists across Resolve restarts.

#### 6.2 Bubble component [M] [TDD]

CREATE component test for `Bubble.tsx`:

- Renders sparkle icon by default
- Pulses when generation in progress
- Flashes green on success, red on error
- Click expands the window

CREATE `src/renderer/components/bubble/Bubble.tsx` with Tailwind classes for all states.

CREATE `src/renderer/stores/ui-store.ts` for mode (`bubble` | `expanded`) and bubble state (`idle` | `generating` | `success` | `error`).

**Verify:** Component tests pass.

#### 6.3 Expanded window UI [M] [TDD]

CREATE component tests for the main panel:

- Tabs (Image / Video / Audio)
- Provider dropdown per tab
- API key input
- Prompt input
- Generate button
- Status display

CREATE components in `src/renderer/components/expanded/`:

- `ExpandedPanel.tsx` (top-level)
- `Tabs.tsx`
- `GenerationPanel.tsx` (reused per tab with `kind` prop)
- `ProviderSelect.tsx`
- `ApiKeyInput.tsx`
- `PromptInput.tsx`
- `GenerateButton.tsx`
- `StatusDisplay.tsx`

CREATE `src/renderer/stores/generation-store.ts` for current generation state.

CREATE `src/renderer/stores/keys-store.ts` for provider API keys (encrypted via @piece/encryption when persisted to disk).

**Verify:** Component tests pass.

#### 6.4 Generation IPC and orchestration [M] [TDD]

CREATE failing test for `src/main/ipc/generation-handlers.js`:

- `generation:run` validates input, calls provider, saves output, imports to Resolve
- Returns clip name on success
- Returns structured error on failure
- Updates bubble state via IPC events

CREATE `src/main/ipc/generation-handlers.js`:

- License check (defense in depth)
- Provider lookup
- Call provider.generate()
- Save output to local file
- Call media-pool.importMedia + appendToTimeline
- Return result

**Verify:** Tests pass with mocked everything. Manual: generate via Google → file appears in Resolve.

#### 6.5 Snapshot UI integration [S] [TDD]

CREATE tests for snapshot UI flow:

- Click snapshot button → window hides → calls main process snapshot → window shows
- Preview displayed in panel
- Reference image passed to image-to-image generation

UPDATE generation panel with snapshot button and preview component.

**Verify:** Manual: Snapshot Frame button works end-to-end.

#### 6.6 Phase 6 verification [GATE]

End-to-end manual:

1. Launch plugin in Resolve → bubble appears.
2. Click bubble → expands to full panel.
3. Sign in via PIECE.
4. License check passes.
5. Enter Google API key, type prompt, click Generate.
6. Bubble shows generating state (if collapsed during gen).
7. Image appears in Media Pool and on timeline.
8. Bubble flashes green.
9. Click Snapshot → window hides → returns with frame preview.
10. Generate with snapshot reference → image-to-image works.

```bash
pnpm run lint        # exit 0
pnpm test            # all pass
pnpm run build       # exit 0
```

COMMIT: `feat(resolve-plugin): floating bubble ui with full generation flow`

---

### Phase 7: Installer (Day 10 evening / spillover)

**Goal:** A user can install the plugin without a terminal. The installer also fetches WorkflowIntegration.node from local Resolve install.

#### 7.1 macOS install.command [M]

CREATE `src/installer/macos/install.command`:

- Bash script
- Detects user's Library path: `$HOME/Library/Application Support/Blackmagic Design/DaVinci Resolve/Workflow Integration Plugins/`
- Auto-detects WorkflowIntegration.node from Resolve's Sample Plugin location: `/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Workflow Integrations/Examples/SamplePlugin/`
- Copies plugin built folder (dist/) to user's Library path (NO sudo — per-user install)
- Copies manifest.xml to the plugin folder
- Copies WorkflowIntegration.node into the plugin folder
- Removes quarantine xattr on copied files (`xattr -rd com.apple.quarantine`)
- Echo success message and exit

CREATE matching `src/installer/macos/uninstall.command`.

**Note:** This is the per-user install path, NO sudo required. Goal: zero password prompts. For dev, use `pnpm run link:dev` (symlink) instead.

**Verify:** On a clean Mac without the plugin: double-click install.command → completes without password → plugin appears in Resolve's Workflow Integrations menu.

#### 7.2 Build script [S]

CREATE `scripts/build-installer.js`:

- Runs `pnpm run build` to build renderer + main
- Creates release folder: `release/PIECE Studio/`
- Copies `dist/main/index.cjs`, `dist/renderer/`, `manifest.xml`
- Copies installer scripts
- Bundles into `release/PIECE_Studio_v1.0.0.zip`

**Verify:** Run script → zip file produced with correct structure.

#### 7.3 Phase 7 verification [GATE]

Clean Mac without prior install:

1. Download zip.
2. Unzip.
3. Double-click install.command.
4. No password prompt.
5. Open Resolve → Workspace → Workflow Integrations → PIECE Studio.
6. Plugin loads.

COMMIT: `feat(resolve-plugin): per-user installer for macos`

---

## Out of Scope for v1.0

These are explicitly NOT in this plan. They are reserved for v2.0:

- Timeline-bridge between PIECE projects and Resolve timelines
- Screenplay/Rundown/Shot import from PIECE
- Auto-generation of Resolve timeline structure from PIECE rundown
- Proxy render and upload to PIECE
- Comments sync between PIECE and Resolve markers
- Real-time collaboration via WebSocket
- Multi-user team features inside the plugin
- Windows installer (delivered separately after macOS proves the model)
- Code signing and notarization (separate phase, requires Apple Developer Program)
- Stripe/Lemon Squeezy webhook integration for automated license issuance (manual grant via admin API for first 50 customers)
- Generation history and analytics
- Quota management
- ReplaceClip workflow for AI re-generation without losing color/effects (research item)

---

## Success Criteria

| Metric                           | Target                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| All tests pass                   | `pnpm test` exits 0                                                                                           |
| Lint clean                       | `pnpm run lint` exits 0, zero warnings                                                                        |
| Build clean                      | `pnpm run build` exits 0                                                                                      |
| Plugin installs without password | macOS user-level install verified                                                                             |
| Auth flow end-to-end             | Device Code Flow: code shown → user enters on website → plugin authorized                                     |
| License gating works             | Without license: blocked. With license: full access                                                           |
| All providers wired              | Image (Google, fal Flux, Replicate), Video (fal Kling, Veo, Luma), Audio (fal ElevenLabs, Stable Audio, Fish) |
| Generation works end-to-end      | Prompt → API call → file → Media Pool → Timeline                                                              |
| Snapshot works                   | Current frame → GrabStill + ExportStills → preview                                                            |
| Image-to-image works             | Snapshot → reference → Gemini edit → result on timeline                                                       |
| Floating bubble UI               | Always on top, draggable, animated states                                                                     |
| Code follows PIECE iron-laws     | No console.log, no process.env, no bare require, no Cyrillic, ESM source                                      |
| No electron dependency           | Plugin runs inside Resolve's runtime, electron NOT in package.json                                            |

---

## Risks and Mitigations

| Risk                                                                          | Severity | Mitigation                                                                                                                                 |
| ----------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| WorkflowIntegration.node API has JS bugs (GrabStill, etc.)                    | High     | Each Resolve binding has unit tests with mocked native module. Two-step snapshot fallback. Document bugs and workarounds.                  |
| Resolve's Node.js runtime doesn't support ESM                                 | High     | Source is ESM, built to CJS via esbuild. Phase 1 explicitly verifies loading in Resolve.                                                   |
| Device Code Flow UX is slower than direct auth                                | Low      | Standard OAuth pattern (used by GitHub CLI, Firebase CLI, etc.). Code is displayed prominently, expires in 10 minutes.                     |
| `@piece/encryption` requires keys not available in plugin context             | Medium   | Read encryption package source first. Key stored in `~/.piece-studio/.keyfile` (generated on first run).                                   |
| Vite + Tailwind v4 + React 19 renderer not loading in Resolve's BrowserWindow | Medium   | Phase 1 explicitly verifies each piece. If broken, drop Tailwind v4 to v3, document why.                                                   |
| Pino logger stdout not visible in Resolve                                     | Medium   | File transport writes to `~/.piece-studio/logs/`. Stdout is a bonus, not required.                                                         |
| Tests for native module integration are slow / fragile                        | Medium   | All native module interactions go through thin wrappers that are mocked in unit tests. Real API only touched in manual verification gates. |
| 10 days is too aggressive for one developer                                   | High     | Plan has clear gates between phases. If Phase 2 takes 3 days instead of 2, Phase 7 (installer) slips. The MUST-have is Phases 1–6.         |

---

## Per-Phase Task Tracking

Use a TodoWrite list for each phase. NEVER bundle multiple sub-tasks into one item.

### Phase 1 todos

- [ ] 1.1 Create app directory and package.json (NO electron dep)
- [ ] 1.2 Register in pnpm-workspace.yaml
- [ ] 1.3 TypeScript config for renderer
- [ ] 1.4 Vite config for renderer
- [ ] 1.5 esbuild config for main process (ESM → CJS)
- [ ] 1.6 ESLint flat config (eslint.config.js)
- [ ] 1.7 Vitest config
- [ ] 1.8 Plugin manifest.xml (FilePath → dist/main/index.cjs)
- [ ] 1.9 Standalone plugin config module (TDD)
- [ ] 1.10 Plugin logger with file transport (TDD)
- [ ] 1.11 Minimal main process entry point (TDD)
- [ ] 1.12 Dev workflow: build + symlink to Resolve
- [ ] 1.13 Minimal renderer with Tailwind
- [ ] 1.14 Phase 1 verification gate

### Phase 2 todos

- [ ] 2.1 Resolve client wrapper with createRequire (TDD)
- [ ] 2.2 Media pool operations — correct AppendToTimeline signature (TDD)
- [ ] 2.3 Snapshot frame — GrabStill + ExportStills two-step (TDD)
- [ ] 2.4 Phase 2 verification gate

### Phase 3 todos

- [ ] 3.1 Provider interface and registry (TDD)
- [ ] 3.2 HTTP utilities — mock via vi.stubGlobal('fetch') (TDD)
- [ ] 3.3 Google Gemini provider (TDD)
- [ ] 3.4 fal.ai providers (TDD) — one task per provider file
- [ ] 3.5 Replicate provider (TDD)
- [ ] 3.6 Fish Audio provider (TDD)
- [ ] 3.7 Provider bootstrap
- [ ] 3.8 Phase 3 verification gate

### Phase 4 todos

- [ ] 4.1 Token storage with encryption — keyfile-based, NO node-machine-id (TDD)
- [ ] 4.2 Device Code Flow controller (TDD)
- [ ] 4.3 PIECE API client (TDD)
- [ ] 4.4 IPC handlers for auth (TDD)
- [ ] 4.5 Auth UI — Device Code Screen (TDD)
- [ ] 4.6 Phase 4 verification gate

### Phase 5 todos

- [ ] 5.1 License check service (TDD)
- [ ] 5.2 License IPC and store (TDD)
- [ ] 5.3 Upgrade screen UI
- [ ] 5.4 License gating throughout app
- [ ] 5.5 Phase 5 verification gate

### Phase 6 todos

- [ ] 6.1 Floating bubble window (Resolve's BrowserWindow)
- [ ] 6.2 Bubble component (TDD)
- [ ] 6.3 Expanded window UI (TDD)
- [ ] 6.4 Generation IPC and orchestration (TDD)
- [ ] 6.5 Snapshot UI integration (TDD)
- [ ] 6.6 Phase 6 verification gate

### Phase 7 todos

- [ ] 7.1 macOS install.command
- [ ] 7.2 Build script
- [ ] 7.3 Phase 7 verification gate

### Backend prerequisites (DO FIRST or in parallel with Phase 1)

- [ ] B.1 Device Code Flow endpoints (POST device-code, poll, verify)
- [ ] B.2 Device Code frontend page (/device)
- [ ] B.3 Product licenses concept (separate collection, NOT embedded in user)
- [ ] B.4 ESLint, build, tests green

---

## Notes for Claude Code Agent

1. **Read existing PIECE code first.** Before writing any new file, read 2–3 similar files in the existing codebase. Match the style exactly. If a backend service has a `controllers/` folder, use the same pattern. If shared packages export factory functions, do the same.

2. **Use @piece/\* packages where appropriate, but NOT blindly.** The plugin runs outside the monorepo when installed. Use `@piece/encryption` and `@piece/domain-types` (bundled at build time). Do NOT use `@piece/config` (requires monorepo root) or `@piece/logger` (requires AsyncLocalStorage context). Use the plugin's own `config.js` and `logger.js` instead.

3. **TDD is non-negotiable.** Every implementation file has a corresponding test file. Tests are written FIRST and FAIL FIRST. Then implementation makes them pass. No exceptions, even for "trivial" code.

4. **Run the full lint+test suite at every phase gate.** Don't trust incremental runs. Run `pnpm run lint && pnpm test && pnpm run build` and verify exit 0.

5. **Commit per phase, not per file.** Each phase gets one squashed commit message in conventional commits format. NO push, NO deploy — only local commits.

6. **If you hit a real blocker** (e.g., Resolve's runtime doesn't support something, or a @piece/\* package doesn't expose what you need): STOP, investigate root cause, document in chat with user (Alex). Do NOT apply quick fixes.

7. **Reference the prototype but do NOT copy it.** The prototype lives in a separate folder. Read it for behavior reference (especially Resolve API workarounds) but rewrite each piece following PIECE conventions.

8. **The plugin is NOT a standalone Electron app.** It runs inside Resolve's Electron runtime. `electron` is NOT a dependency. BrowserWindow and other Electron APIs are imported but resolved from Resolve's built-in modules at runtime. Never call `app.setAsDefaultProtocolClient()`, `app.quit()`, or other app-level Electron APIs — those belong to Resolve.

9. **Source ESM, output CJS.** All source code uses `import`/`export` (ESM). The esbuild step bundles `src/main/index.js` into `dist/main/index.cjs` (CJS) for Resolve runtime compatibility. The one exception for `require` is `createRequire(import.meta.url)` for loading `.node` native modules.

10. **All file names in kebab-case.** All class/component names in PascalCase. All variables and functions in camelCase. All constants in UPPER_SNAKE_CASE. No exceptions.

11. **English only in code, comments, logs, file names, commit messages.** Russian only in chat with Alex.

12. **Use the iron-laws as a checklist on every commit.** Re-read `.claude/rules/iron-laws.md` before committing each phase.

---

## Changelog (v1.0 → v2.0)

Fixes applied after deep analysis on 2026-04-12:

1. **[CRITICAL] Removed `electron` from dependencies.** Plugin runs inside Resolve's Electron runtime. Adding electron creates 200MB bloat and version conflicts.
2. **[CRITICAL] Added `apps/resolve-plugin` to `pnpm-workspace.yaml`.** The workspace config only has `apps/backend/*` and `apps/frontend` — NOT `apps/*`.
3. **[CRITICAL] Replaced custom URL scheme auth with Device Code Flow (RFC 8628).** `app.setAsDefaultProtocolClient()` cannot be called from a plugin — the `app` belongs to Resolve.
4. **[CRITICAL] Created standalone config module.** `@piece/config` walks up to find `pnpm-workspace.yaml` which doesn't exist when the plugin is installed outside the monorepo.
5. **[CRITICAL] Added `createRequire` for `.node` native module loading.** ESM cannot directly `import` compiled `.node` addons.
6. **[SIGNIFICANT] Fixed `AppendToTimeline` signature.** Correct API: `{mediaPoolItem, startFrame, endFrame, mediaType}`, NOT `{mediaPoolItem, mediaType, trackIndex, recordFrame}`.
7. **[SIGNIFICANT] Replaced `electron .` dev workflow.** Can't run plugin standalone — need build → symlink → restart Resolve.
8. **[SIGNIFICANT] Replaced `ExportCurrentFrameAsStill` with GrabStill + ExportStills.** `ExportCurrentFrameAsStill` is NOT in the official DaVinci Resolve JS Scripting API.
9. **[SIGNIFICANT] Redesigned B.1+B.2 for Device Code Flow.** New endpoints: `POST /v1/auth/device-code`, `POST /v1/auth/device-code/poll`, `POST /v1/auth/device-code/verify`. Frontend page at `/device`.
10. **[SIGNIFICANT] Fixed `manifest.xml` FilePath.** Points to `dist/main/index.cjs` (build output), not `src/main/index.js` (source).
11. **[MINOR] Fixed fetch mock pattern.** Use `vi.stubGlobal('fetch', vi.fn())` not `vi.mock('node:undici')`.
12. **[MINOR] Removed `node-machine-id` dependency.** Replaced with `crypto.randomBytes(32)` stored in `~/.piece-studio/.keyfile`. Avoids native compilation issues in Resolve.
13. **[MINOR] Added Pino file transport.** Resolve's stdout may not be visible. Logs write to `~/.piece-studio/logs/`.
14. **[MINOR] Changed installer to copy, dev to symlink.** `pnpm run link:dev` creates symlink for development. Installer copies for production.
15. **[MINOR] Changed ESLint to flat config format.** `eslint.config.js` instead of `.eslintrc.cjs` — matches project convention.

---

**End of plan v2.0. Ready for execution by Claude Code agent in VS Code.**
