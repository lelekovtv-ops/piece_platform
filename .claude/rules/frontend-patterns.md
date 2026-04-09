# Frontend Patterns

## Stack

Frontend uses **Next.js 16 + React 19 + TypeScript** with App Router.
All client code uses ES modules (`import`/`export`). Never use `require()`.

## Routing

Use **Next.js App Router** (`src/app/` directory).

- Route structure is file-system based by Next.js conventions
- Prefer Server Components by default; use Client Components only when needed (`'use client'`)
- Do not introduce TanStack Router

## State Management

| Type | Tool | Notes |
|------|------|-------|
| Client/editor state | Zustand 5 | Main state layer for screenplay, timeline, bible, projects |
| Auth/session state | Zustand | `src/lib/auth/auth-store.ts` |
| Server fetch | `authFetch` wrappers + feature API modules | No TanStack Query in this codebase |
| Real-time collaboration | WebSocket ops (`emitOp`) | Used by screenplay/timeline/bible flows |

### Store Patterns

- Use small focused Zustand slices when possible
- Persist only what is needed (`persist` + `safeStorage`)
- Avoid unbounded arrays/maps in stores
- Keep server synchronization logic explicit in actions (API call or WebSocket op)

## Data Fetching

- Use centralized API utilities under `src/lib/api/`
- Use authenticated wrapper (`authFetch`) for protected endpoints
- Keep response format flat and predictable
- Handle token refresh via existing auth flow (`auth-store`, `auth-fetch`)

## Styling & UI

| Area | Tool |
|------|------|
| Utility styling | Tailwind CSS v4 |
| Icons | Lucide React |
| Rich text editing | Slate (`slate`, `slate-react`, `slate-history`) |
| Flow editor | `@xyflow/react` v12 |
| 3D/scene features | Three.js |
| Vision/gesture features | MediaPipe Tasks Vision |

There is no Radix UI Themes-based design system in this repository.

## Feature Structure

Prefer modular organization by feature:

```
src/features/{feature-name}/
  components/
  hooks/
  lib/
  api/
  types/
```

Shared cross-feature code belongs under `src/lib/`, `src/components/`, or `src/store/`.

## File Naming

| Type | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | `auth-fetch.ts` |
| Components | PascalCase | `ProjectCard` |
| Variables/functions | camelCase | `loadProjectById` |
| Constants | UPPER_SNAKE_CASE | `MAX_RECENT_PROJECTS` |

## Real-Time & Collaboration

- For collaborative domains, prefer operation-based sync (`emitOp`) instead of ad-hoc payload pushes
- Include enough metadata to avoid echo loops and merge conflicts
- Keep local optimistic updates reversible

## Performance & Reliability

- Clean up module-level resources during HMR using `import.meta.hot.dispose()`
- Avoid repeated heavyweight initialization during render
- Keep browser-only APIs behind client boundaries
- Guard optional features (for example advanced media modules) with graceful fallback paths

## i18n Status

`react-i18next` is not currently installed in this frontend.
Do not scaffold new code assuming i18n infrastructure exists unless it is added as part of the same task.

## Anti-patterns

- **NEVER** add TanStack Router/TanStack Query/TanStack Form/TanStack Table patterns as defaults
- **NEVER** document or build for Vite in this app (framework is Next.js)
- **NEVER** use `require()`
- **NEVER** create ad-hoc fetch clients when `authFetch`/shared API modules are available
- **NEVER** bypass existing auth token lifecycle logic
- **NEVER** grow long-lived in-memory structures without limits
- **NEVER** leave HMR side effects uncleaned for singletons/listeners/timers
