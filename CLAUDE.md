# piece — Project Guidelines

> **piece** = KOZA cinematic AI platform + enterprise multi-user backend.
> Frontend: Next.js 16 + React 19 + TypeScript + Tailwind v4 (ported from KOZA).
> Backend: Express.js + MongoDB + @piece/* packages (ported from koza-studio).

## Language

- **Chat with user — strictly Russian.** All responses, explanations, questions — in Russian only.
- **Everything else — strictly English.** This includes:
  - Code comments
  - Log messages
  - Error messages
  - Commit messages (conventional commits)
  - Documentation (CLAUDE.md, .claude/rules/, .claude/skills/, README, JSDoc)
  - Variable names, function names, constants
  - UI text — through i18n, never hardcoded
- **Zero Cyrillic in source files, docs, skills, or config.** The only place for Russian is chat responses to the user.

## General Rules

- **ES modules only** (`import`/`export`). Never `require()`.
- **File naming**: kebab-case. React components: PascalCase.
- **File size**: 800 lines preferred, 1000 hard max.
- **Git**: 3 branches: `dev` → `stage` → `main`. Work on `dev`.
- **Comments**: Do not add unless asked.
- **ESLint**: Never disable rules. Zero warnings.

## Architecture

**Monolith** backend (Express.js) + separate frontend (Next.js 16) + WebSocket gateway.

```
piece/
├── apps/
│   ├── backend/
│   │   ├── piece/              # Main backend service (Express)
│   │   └── websocket-gateway/  # Real-time collaboration
│   └── frontend/               # Next.js 16 + React 19 + TypeScript
│       ├── src/                # Components, stores, libs, hooks
│       ├── public/             # Static assets
│       └── server/             # WS collaboration server
├── packages/                   # Shared @piece/* libraries
├── docker/                     # Dockerfiles
├── tests/e2e/                  # Playwright E2E tests
├── nginx/                      # Reverse proxy config
└── docker-compose.yml          # Infrastructure
```

**NOTE:** Frontend (`apps/frontend/`) uses **TypeScript** and **Next.js conventions**.
This is an exception to the JS-only rule — the frontend was ported from KOZA (TypeScript codebase).

## @piece/* Libraries

### Core Packages

| # | Package | Purpose | Rule |
|---|---------|---------|------|
| 1 | @piece/config | Config management | FIRST import in every service |
| 2 | @piece/logger | Structured logging (Pino) | NEVER console.log |
| 3 | @piece/auth-middleware | JWT authentication | NEVER jsonwebtoken directly |
| 4 | @piece/cors-middleware | CORS handling | FIRST middleware after helmet |
| 5 | @piece/permissions | RBAC + Scope (ABAC) | initializePermissions() required |
| 6 | @piece/validation | Event + input validation | ALL events via factories |

### Additional Packages

| # | Package | Purpose |
|---|---------|---------|
| 7 | @piece/multitenancy | MongoDB multi-tenant access |
| 8 | @piece/cache | Redis + StandardTTL + accountLockout + resendLimiter |
| 9 | @piece/email | AWS SES email sending |
| 10 | @piece/encryption | AES-256-GCM |
| 11 | @piece/i18n | Backend notification/email locales (en, ru) |
| 12 | @piece/test-utils | Mocks + fixtures |

Dependencies: `"@piece/logger": "*"` (NOT `workspace:*`)

## Service Setup Pattern

Config first, logger second, middleware chain, health, background init, process handlers.

```javascript
import { config } from './config.js';                              // 1. Config FIRST
import { createLogger, createRequestLoggingMiddleware } from '@piece/logger'; // 2. Logger
import express from 'express';
import helmet from 'helmet';
import { corsMiddleware } from '@piece/cors-middleware';

const app = express();
app.use(helmet());                              // 3. Security
app.use(corsMiddleware);                        // 4. CORS
app.use(express.json({ limit: '10mb' }));       // 5. Body (BEFORE logging)
app.use(createRequestLoggingMiddleware(logger)); // 6. Request logging

// Health → Routes → Process handlers → Listen → Background init
```

## Error Handling

Flat: `{ error: 'CODE', message: '...', details: [...] }`. NEVER `{ success: false }`.

## API Route Prefixes

| Prefix | Purpose | Auth |
|--------|---------|------|
| `/v1/` | Public API | Bearer token |
| `/internal/` | Service-to-service | x-internal-token |
| `/admin/` | System administration | Admin bearer token |

## Domain-Specific Notes (KOZA Migration)

This project is a migration from the KOZA cinematic AI production platform.

### Core Domain Concepts

| Concept | Description |
|---------|-------------|
| **Screenplay** | Text source of truth (blocks/scenes) |
| **Rundown** | Structure authority (timing, hierarchy, visuals) |
| **Timeline** | Cache projected from rundown (shots, audio) |
| **Bible** | Production reference (characters, locations, props) |
| **Pipeline** | Modular AI processing chain (scene analysis → shot planning → prompt composition) |
| **Breakdown Studio** | Visual pipeline editor (React Flow) |

### AI Integrations

| Provider | Usage |
|----------|-------|
| OpenAI (GPT-4o) | Image generation, analysis |
| Anthropic (Claude) | Scene analysis, shot planning |
| Google (Gemini) | Image generation, reference selection |

### Frontend Features (React Flow)

The workflow editor scaffold is included for the pipeline editor. Located at:
`apps/frontend/platform/src/features/workflow/`

Additional frontend domain tooling in active use:
- Slate (`slate`, `slate-react`, `slate-history`) for screenplay editing
- `@xyflow/react` for pipeline editor
- Three.js for 3D interactions
- MediaPipe Tasks Vision for gesture/vision features

## Anti-patterns

- NEVER `console.log` — use `@piece/logger`
- NEVER `process.env` directly — use `@piece/config`
- NEVER `require()` — ESM only
- NEVER `import jsonwebtoken` — use `@piece/auth-middleware`
- NEVER direct HTTP between services — use internal routes or WebSocket
- NEVER raw `cors` — use `@piece/cors-middleware`
- NEVER `import { ObjectId } from 'mongodb'` — use `mongoIdUtils`
- NEVER flat error with `success: false`
- NEVER `eslint-disable`
- NEVER omit process error handlers
- NEVER use Gmail API, nodemailer, or SMTP for email — use `@piece/email` (AWS SES)
- NEVER accept disposable email addresses — use `validateEmailDomain()` from `@piece/validation/email`

## Development Commands

```bash
pnpm run dev           # Start all services + frontend
pnpm run dev:services  # Backend only
pnpm run dev:platform  # Frontend only
pnpm run infra         # Start Docker infrastructure (MongoDB, Redis, MinIO, Qdrant)
pnpm run infra:stop    # Stop infrastructure
pnpm run lint          # ESLint all packages
pnpm run build         # Build all
pnpm test              # Run all tests
```

## Ports

| Service | Port | Note |
|---------|------|------|
| MongoDB | 27022 | Docker container |
| Redis | 6384 | Docker container |
| MinIO API | 9006 | S3-compatible storage |
| MinIO Console | 9007 | Web UI |
| Qdrant HTTP | 6337 | Vector search |
| Qdrant gRPC | 6338 | Vector search |
| Backend | 4030 | Express API |
| WebSocket GW | 4031 | Real-time |
| Frontend | 5201 | Next.js dev server |
| WS Collab | 8080 | Collaboration WebSocket |

**Important:** These ports are unique to this project. Other projects on this machine use different ports.
All infrastructure runs via Docker Compose — NEVER use Homebrew-installed MongoDB/Redis.

## Available Commands

| Command | Description |
|---------|-------------|
| `/dev` | Start development environment |
| `/deploy` | Deploy to staging/prod |
| `/catchup` | Restore context after /clear |
| `/brain` | Structured brainstorming before implementation |
| `/plan` | Create implementation plan (built-in plan mode + auto-loaded methodology) |
| `/audit` | Run 8-step code audit |
| `/audit-plan` | Post-implementation plan audit |
| `/full-audit` | Full audit with E2E, smoke tests, logs |
| `/fix-audit` | Deep remediation of all audit findings |
| `/debug` | Systematic root-cause debugging |
| `/tdd` | Test-driven development cycle |
| `/design` | Frontend component design with project UI stack |
| `/code-review` | Request code review via subagent |
| `/sync-docs` | Bidirectional docs-code sync |
| `/check-api` | Frontend-Backend API consistency check |
| `/update-docs` | Update docs after code changes |
| `/check-cache-indexes` | Audit Redis cache and MongoDB index coverage |

## Reference

| Topic | Location |
|-------|----------|
| Backend patterns | `.claude/rules/backend-patterns.md` |
| Frontend patterns | `.claude/rules/frontend-patterns.md` |
| Database patterns | `.claude/rules/database-patterns.md` |
| Deploy & infra | `.claude/rules/deploy-infra.md` |
| Logging rules | `.claude/rules/logging-rules.md` |
| Testing guide | `.claude/rules/testing-guide.md` |
| Audit workflow | `.claude/rules/audit-workflow.md` |
| Shared packages | `.claude/rules/shared-packages.md` |
| React Flow | `.claude/rules/react-flow-patterns.md` |

## Iron Laws

1. NO production code without a failing test first (TDD)
2. NO completion claims without fresh verification evidence
3. NO random fixes — investigate root cause before any code change
4. NO skipping code review — even for "simple" changes
5. NO console.log in backend — use @piece/logger
6. NO process.env directly — use @piece/config
7. NO require() — ESM imports only
8. NO eslint-disable — fix the code
9. NO hardcoded secrets — all secrets in .env
10. NO direct MongoDB ObjectId imports — use mongoIdUtils
11. NO Gmail API, nodemailer, or SMTP — use @piece/email (AWS SES)
12. NO accepting disposable emails — use validateEmailDomain() on registration
13. NO quick fixes or bandaid patches — always investigate root cause
14. NO pausing between plan steps to ask "should I continue?" — execute the approved plan to completion
15. NO automatic push or deploy after completing a plan — only commit
16. NO bundling plan items — every plan sub-task = one tracked task
17. NO trusting agent output — verify files exist, registration works, build passes
18. NO "plan complete" without line-by-line reconciliation
