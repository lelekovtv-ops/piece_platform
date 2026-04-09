# Project Cleanup & Documentation Session — 2026-04-10

## Goal
Full project audit: remove junk files, verify CLAUDE.md accuracy, create missing rule files, configure IDE.

## Completed

### 1. Removed 8 duplicate files (macOS Finder artifacts)
- 2 root duplicates (`.env.staging 2.template`, `.git-commit-msg 2.txt`)
- 4 sentry config duplicates in `apps/frontend/`
- 2 `tsconfig.tsbuildinfo` duplicates in `apps/frontend/`

### 2. Fixed CLAUDE.md
- Commands: `dev:services` → `dev:backend`, `dev:platform` → `dev:frontend`, added `dev:ws`
- Packages: added `@piece/pubsub` and `@piece/domain-types` (12 → 14)
- Ports: added NATS (4223), Postgres (5433), Grafana (3001); clarified dev vs Docker ports
- Reference table: expanded from 9 to 16 entries

### 3. Updated existing rules
- `deploy-infra.md`: +8 services, nginx routing matrix, rate limits, cache headers, monitoring stack, fixed "Vite → Next.js" error, removed non-existent `deploy-prod.yml`
- `backend-patterns.md`: added dev.sh startup flow section

### 4. Created 6 new rule files (+1115 lines)

| File | Key Content |
|------|-------------|
| `auth-flow.md` | 13 endpoints, JWT RS256/HS256, lockout 5 attempts/15 min, refresh grace 30s, magic links 3/day, 10 audit events |
| `websocket-gateway.md` | 7 client + 11 server events, rooms `project:{id}`, lock TTL 5 min, 8 Prometheus metrics |
| `permissions-system.md` | 3 roles, 47 entities, 5 actions, ReBAC with inheritance |
| `frontend-auth.md` | Token in-memory, authFetch 2 retries + 15s timeout, auto-refresh on 401 |
| `frontend-structure.md` | 24 routes, 23 stores, 10 hooks, full lib/ module map |
| `domain-types.md` | 7 type files, frozen enums, factories, cross-type relationships |

### 5. Configured .gitignore
- Added: `*.code-workspace`, `*.tsbuildinfo`, `* 2.*`/`* 3.*`, `scripts/*.app/`, `.git-commit-msg.txt`

### 6. Created .vscode/
- `extensions.json` — 15 recommendations (ESLint, Prettier, Tailwind, Docker, Vitest, Playwright, GitLens, etc.)
- `settings.json` — autoformat, ESLint autofix, file exclusions, Tailwind class regex

## Commits

| Hash | Message |
|------|---------|
| `7ad45cd` | `chore: cleanup project structure, fix docs, add IDE config` |
| `a6ec67a` | `docs: add 6 new rule files, update deploy-infra and backend-patterns` |

## Rule Files Coverage (18 total)

| Category | Files |
|----------|-------|
| Backend | backend-patterns, auth-flow, websocket-gateway, permissions-system |
| Frontend | frontend-patterns, frontend-auth, frontend-structure, react-flow-patterns |
| Data | database-patterns, domain-types, pubsub-events |
| Infrastructure | deploy-infra, logging-rules, shared-packages |
| Process | testing-guide, audit-workflow, iron-laws, workflow-rules |

## Remaining Work

1. **`deploy-prod.yml`** — production deploy workflow not yet created
2. **Grafana dashboards** — Prometheus configured but dashboards empty
