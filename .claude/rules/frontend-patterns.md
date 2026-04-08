# Frontend Patterns

## Stack

React 18 + Vite 5. All client code uses ES modules (`import`/`export`). Never use `require()`.

## State Management

| Type | Tool | Example |
|------|------|---------|
| Server state | TanStack Query | Users, teams, resources |
| Client state | Zustand | Lightweight UI stores |
| Routing | TanStack Router | File-based routing |
| Forms | TanStack Form | Form state, validation |
| Tables | TanStack Table | Sorting, filtering, pagination |

### TanStack Query Defaults

```javascript
{
  staleTime: 5 * 60 * 1000,       // 5 minutes
  gcTime: 10 * 60 * 1000,         // 10 minutes
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
  networkMode: 'online',
  retry: (failureCount, error) => {
    const status = error?.response?.status;
    if ([401, 403, 429, 502, 503].includes(status)) return false;
    return failureCount < 2;
  },
  retryDelay: (attempt) => Math.min(2000 * 2 ** attempt, 10000),
}
```

Mutations: `networkMode: 'online'`, `retry: false`.

## Design System -- Radix UI Themes

| Property | Value |
|----------|-------|
| Accent | violet |
| Gray | slate |
| Radius | large |
| Appearance | dark |

### Radix Color Scale (Dark Theme)

In dark mode, **higher index = lighter color**. `--gray-1` is darkest (near black), `--gray-12` is lightest (near white). Same for all color scales.

| Token | Dark Mode | Example Use |
|-------|-----------|-------------|
| `--gray-1` | Darkest | Page background |
| `--gray-2` | Very dark | Card/panel background |
| `--gray-3` | Dark | Hover states |
| `--gray-4`--`--gray-6` | Medium-dark | Borders, separators |
| `--gray-7`--`--gray-9` | Medium | Muted text, icons |
| `--gray-10`--`--gray-11` | Light | Secondary text |
| `--gray-12` | Lightest | Primary text |

Use Radix layout components (`Flex`, `Box`, `Grid`) instead of raw divs. Use Tailwind CSS for custom styling.

**NEVER** add `border: '1px solid ...'` to Radix Cards -- they have built-in borders.

## Internationalization -- react-i18next

Locales stored in `locales/en/` and `locales/ru/` as JSON files. **ALL** UI text must go through `useTranslation()`.

### Dependencies

```json
"i18next": "^23.0.0",
"react-i18next": "^15.0.0",
"i18next-browser-languagedetector": "^8.0.0"
```

### Architecture

| File | Purpose |
|------|---------|
| `utils/i18n.js` | Main config, static namespace loading, language management |
| `utils/i18nDynamicLoader.js` | Lazy namespace loading with deduplication and timeout |
| `hooks/useTranslationLoader.js` | Hook for loading state tracking in components |

### Namespace Strategy

Two types: **static** (bundled at app init) and **dynamic** (loaded on demand per route).

| Type | Namespaces | When Loaded |
|------|-----------|-------------|
| Static | `common`, `errors`, `ui`, `validation` | App initialization |
| Dynamic | Feature namespaces (`auth`, `settings`, etc.) | Route `beforeLoad` |

### Static Namespace Usage

```jsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation('common');
  return <Button>{t('save')}</Button>;
}
```

### Dynamic Namespace Loading

Dynamic namespaces MUST use `beforeLoad` in TanStack Router:

```jsx
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { loadNamespaces } from '@/utils/i18n.js';
import i18n from '@/utils/i18n.js';

export const Route = createFileRoute('/_authenticated/settings')({
  beforeLoad: async () => {
    await loadNamespaces(['settings'], i18n.language);
  },
  component: () => <Outlet />,
});
```

### Loading State in Components

Use `useTranslationLoader` when you need to show a loader while translations load:

```jsx
import { useTranslationLoader } from '@/hooks/useTranslationLoader.js';

function SettingsPage() {
  const { isLoading } = useTranslationLoader(['settings']);
  if (isLoading) return <ContentLoader />;
  // ... render with translations
}
```

### Language Switching

```jsx
import { updateLanguage } from '@/utils/i18n.js';

// In a language selector component:
await updateLanguage('ru'); // Switches language, reloads all loaded namespaces
```

Sync language from user profile after login:

```jsx
import { syncLanguageFromUserProfile } from '@/utils/i18n.js';

// After successful login:
await syncLanguageFromUserProfile(user.language);
```

### Locale File Structure

One JSON file per namespace per language. Keys are nested by feature area:

```json
{
  "title": "Settings",
  "tabs": {
    "general": "General",
    "security": "Security"
  },
  "actions": {
    "save": "Save Changes",
    "reset": "Reset"
  }
}
```

### Backend i18n

For email templates, notifications, and server-side messages:

```javascript
import { t } from 'piece/i18n';

const subject = t('email.verification.subject', userLanguage);
const message = t('email.invitation.message', userLanguage, { teamName: 'Acme' });
```

Backend locales stored in `packages/i18n/locales/en.json` and `ru.json`.

## API Client

Centralized `api.js` with flat response format -- `response.data` gives direct access to payload (no `data.data`).

### Headers

| Header | Value | Purpose |
|--------|-------|---------|
| Authorization | `Bearer {token}` | JWT authentication |
| x-selected-team | `{teamId}` | Multi-tenancy context |
| X-Correlation-ID | `{uuid}` | Request tracing |

### Error Interceptors

- **401** -- automatic token refresh, retry original request
- **403** -- automatic permission state update
- **429** -- axios interceptor retry with exponential backoff (2s/4s/8s), max 3 retries, respects `Retry-After`

## File Naming

| Type | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | `user-profile.jsx` |
| Components | PascalCase | `UserProfile` |
| Variables | camelCase | `userData` |
| Hooks | camelCase | `useUserProfile` |
| Stores | camelCase | `useAuthStore` |

## Icons

Lucide React only:

```jsx
import { Plus, Trash2, Settings } from 'lucide-react';
```

Never use Font Awesome, Hero Icons, or other icon libraries.

## Feature Module Structure

```
features/{feature-name}/
  api/            # API service functions
  hooks/          # TanStack Query hooks, custom hooks
  components/     # Feature-specific components
  pages/          # Route page components
  constants/      # Feature constants
```

## Route Guards

| Helper | Description |
|--------|-------------|
| `createAuthenticatedRoute()` | Requires auth + team selection |
| `createAuthOnlyRoute()` | Requires auth, no team needed |
| `createPublicRoute()` | No auth required |

## HMR Cleanup Pattern

Module-level singletons MUST use `import.meta.hot.dispose()`:

```javascript
export const singleton = new MySingleton();
if (import.meta.hot) {
  import.meta.hot.dispose(() => singleton.destroy());
}
```

## Network Recovery

When network recovers, queries are invalidated in 3 priority waves:

| Priority | Keys | Delay | Purpose |
|----------|------|-------|---------|
| P1 | `profile`, `teams`, `user` | immediate | Critical user data |
| P2 | `tables`, `flows`, `agents` | 200-800ms | Workspace data |
| P3 | `chats`, `channels`, `integrations` | 800-2000ms | Heavy data |

All invalidations use `refetchType: 'active'` -- only refetch queries with mounted components.

## Bounded Data Structures

| Structure | Max Size | Eviction |
|-----------|----------|----------|
| `correlationIdMap` | 500 entries | 60s TTL + oldest removal |
| `cacheMonitor.requests` | 50/key, 200 keys | Oldest removal |
| `failedQueue` | 50 entries | Oldest rejected on overflow |

## Anti-patterns

- **NEVER** use inline/ad-hoc components -- use shared components from `shared/components/`
- **NEVER** disable ESLint rules (`eslint-disable`)
- **NEVER** hardcode UI strings -- use `useTranslation()` (react-i18next)
- **NEVER** use `require()` -- ESM only
- **NEVER** create new Axios instances -- use the centralized `api.js` client
- **NEVER** add borders to Radix Cards -- they have built-in borders
- **NEVER** use `useEffect` + `fetch` -- use TanStack Query
- **NEVER** manage server state in Zustand -- use TanStack Query
- **NEVER** use `invalidateQueries()` without `queryKey` filter or `refetchType: 'active'`
- **NEVER** create module-level `setInterval`/`addEventListener` without cleanup via `import.meta.hot.dispose()`
- **NEVER** grow Map/Array without bounds -- always set max size or TTL
- **NEVER** create a route for a dynamic i18n namespace without `beforeLoad` + `loadNamespaces()`
- **NEVER** set global auth loading state from mutations -- use mutation's own `isPending`
