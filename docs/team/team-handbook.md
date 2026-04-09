# PIECE — Team Handbook

## Team Structure

```
                    ┌─────────────────┐
                    │   Project Owner │
                    │   (Alex)        │
                    │   Vision, final │
                    │   decisions     │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │                             │
     ┌────────┴────────┐          ┌─────────┴─────────┐
     │   Lead Developer │          │   QA Lead          │
     │   (Dev #1)       │          │   (Tester #1)      │
     │   Architecture,  │          │   Test strategy,   │
     │   code review,   │          │   coordination,    │
     │   deployments    │          │   release sign-off  │
     └────────┬────────┘          └─────────┬─────────┘
              │                             │
              │                    ┌────────┼────────┐
              │                    │        │        │
              │               Tester #2  Tester #3  Tester #4
              │               Manual QA  Manual QA  Manual QA
              │               + E2E      + Mobile   + Security
              │
       ┌──────┴──────┐
       │             │
    Dev #2        Dev #3 (AI/Claude)
    Frontend      Backend + AI
```

### Roles

| # | Role | Responsibilities | Reports to |
|---|------|-----------------|------------|
| 1 | **Project Owner (Alex)** | Vision, priorities, final approval, stakeholders | — |
| 2 | **Lead Developer** | Architecture, code review, deployments, mentoring | Alex |
| 3 | **Frontend Developer** | React/Next.js, UI components, styling, i18n | Lead Dev |
| 4 | **Backend/AI Developer** | Express.js, MongoDB, AI pipelines, API | Lead Dev |
| 5 | **QA Lead** | Test strategy, test plans, release approval, automation | Alex |
| 6 | **QA Tester (E2E)** | E2E tests (Playwright), regression testing | QA Lead |
| 7 | **QA Tester (Manual/Mobile)** | Manual testing, mobile responsiveness, UX | QA Lead |
| 8 | **QA Tester (Security/Perf)** | Security testing, load testing, pen testing | QA Lead |

---

## Git Workflow

### Branches

```
main   ← production (piece-app.com), deploy on push
stage  ← staging (staging.piece-app.com), deploy on push
dev    ← integration branch, CI runs on push
feature/xxx ← individual feature branches
bugfix/xxx  ← bug fix branches
hotfix/xxx  ← urgent production fixes
```

### Developer Flow

```
1. git checkout dev
2. git pull origin dev
3. git checkout -b feature/my-task
4. ... write code, commit often ...
5. git push origin feature/my-task
6. Create Pull Request → dev (on GitHub)
7. Lead Dev reviews code
8. QA tests on PR preview / locally
9. Lead Dev merges to dev
10. When ready: dev → stage (staging deploy)
11. QA tests on staging
12. QA Lead signs off
13. stage → main (production deploy)
```

### Rules

- **NEVER** push directly to `main` or `stage`
- **ALWAYS** go through Pull Request
- **ALWAYS** get code review before merge
- Feature branches deleted after merge
- Commit messages: conventional commits (`feat:`, `fix:`, `docs:`, `test:`)
- No force push to shared branches

### Hotfix Process (urgent production bug)

```
1. git checkout main
2. git checkout -b hotfix/critical-bug
3. Fix the bug
4. PR → main (skip stage for critical issues)
5. After merge: main → stage → dev (backport)
```

---

## Daily Workflow

### Daily Standup — 15 min, every morning

Every team member answers 3 questions:
1. What did I do yesterday?
2. What will I do today?
3. Any blockers?

Format: Slack message in `#piece-standup` channel by 10:00 AM.

### Weekly Sprint Review — 1 hour, every Friday

- Demo of completed features
- QA report: bugs found, tests passed
- Next week priorities
- Alex makes final decisions on priorities

---

## Development Standards

### Code Review Checklist

Before approving a PR, Lead Dev checks:

- [ ] Code follows project conventions (ESM, @piece/* packages, no console.log)
- [ ] Tests added for new functionality
- [ ] No hardcoded secrets or API keys
- [ ] Error handling follows flat format `{ error, message, details }`
- [ ] No ESLint errors (warnings acceptable temporarily)
- [ ] Database queries use `@piece/multitenancy`
- [ ] API follows REST conventions (`/v1/`, proper status codes)

### QA Testing Checklist

Before signing off a release, QA Lead confirms:

- [ ] All existing E2E tests pass
- [ ] New features have test cases written
- [ ] Manual testing of critical flows (login, register, create project, edit)
- [ ] Mobile responsiveness checked (iPhone, iPad sizes)
- [ ] Cross-browser check (Chrome, Safari, Firefox)
- [ ] No console errors in browser DevTools
- [ ] Performance: pages load under 3 seconds
- [ ] Security: no sensitive data exposed in network tab

---

## QA Process

### Bug Report Template

```markdown
## Bug Report

**Severity:** Critical / High / Medium / Low
**Environment:** Production / Staging / Local
**Browser:** Chrome 146 / Safari 18 / Firefox

### Steps to Reproduce
1. Go to ...
2. Click ...
3. Enter ...

### Expected Behavior
What should happen

### Actual Behavior
What actually happens

### Screenshots
Attach screenshots or video

### Console Errors
Paste any errors from browser DevTools
```

### Severity Levels

| Level | Definition | Response Time |
|-------|-----------|---------------|
| **Critical** | App is down, data loss, security breach | Fix within hours |
| **High** | Major feature broken, many users affected | Fix within 1 day |
| **Medium** | Feature partially broken, workaround exists | Fix within 1 week |
| **Low** | Cosmetic issue, minor inconvenience | Fix in next sprint |

### Bug Tracking

Use **GitHub Issues** with labels:
- `bug` — confirmed bug
- `severity:critical` / `severity:high` / `severity:medium` / `severity:low`
- `needs-triage` — new bug, not yet reviewed
- `in-progress` — developer is working on it
- `ready-for-qa` — fix deployed, needs QA verification
- `verified` — QA confirmed fix works

---

## Release Process

### Pre-Release Checklist

| Step | Who | What |
|------|-----|------|
| 1 | Lead Dev | All PRs merged to `dev`, CI green |
| 2 | Lead Dev | Merge `dev` → `stage`, deploy to staging |
| 3 | QA Lead | Assign testers to test on staging |
| 4 | QA Team | Execute test plan, log bugs |
| 5 | Devs | Fix bugs found on staging |
| 6 | QA Lead | Re-test fixes, sign off |
| 7 | QA Lead | Write release notes |
| 8 | Alex | Final approval |
| 9 | Lead Dev | Merge `stage` → `main`, production deploy |
| 10 | QA Lead | Smoke test on production |

### Release Notes Template

```markdown
## Release v1.X.X — [Date]

### New Features
- Feature description

### Bug Fixes
- Fix description

### Known Issues
- Issue description

### Testing Summary
- Test cases executed: XX
- Passed: XX
- Failed: XX
- Blocked: XX
```

---

## Communication

### Channels (Slack or Telegram)

| Channel | Purpose | Who |
|---------|---------|-----|
| `#piece-general` | General discussion | Everyone |
| `#piece-standup` | Daily standups | Everyone |
| `#piece-dev` | Technical discussion, code questions | Developers |
| `#piece-qa` | Bug reports, test results | QA + Devs |
| `#piece-releases` | Deploy notifications, release notes | Everyone |
| `#piece-alerts` | Server alerts, monitoring | Lead Dev + Alex |

### Notifications

- **Deploy to staging** → `#piece-releases` (automatic via GitHub Actions)
- **Deploy to production** → `#piece-releases` + `#piece-general`
- **Critical bug found** → `#piece-alerts` + direct message to Lead Dev
- **Server down** → `#piece-alerts` + direct message to Lead Dev + Alex

---

## Access Management

### GitHub Access

| Person | Repository Access | Branch Protection |
|--------|------------------|-------------------|
| Alex | Admin | Can bypass protections |
| Lead Dev | Write | Can merge PRs |
| Dev #2 | Write | PRs only, no direct push to main/stage |
| Dev #3 (AI) | Write | PRs only |
| QA Lead | Read + Issues | Can create/close issues |
| QA Testers | Read + Issues | Can create issues |

### Server Access

| Person | Staging Server | Production Server |
|--------|---------------|-------------------|
| Alex | Full SSH | Full SSH |
| Lead Dev | Full SSH | Read-only SSH |
| Developers | No access | No access |
| QA Team | No access | No access |

### Service Access

| Service | Alex | Lead Dev | Devs | QA |
|---------|------|----------|------|-----|
| GitHub repo | Admin | Write | Write | Read |
| Hetzner console | ✅ | ✅ | ❌ | ❌ |
| MongoDB (prod) | ✅ | Read | ❌ | ❌ |
| Grafana monitoring | ✅ | ✅ | ✅ | ✅ |
| MinIO file storage | ✅ | ✅ | ❌ | ❌ |
| Sentry error tracking | ✅ | ✅ | ✅ | ✅ |

---

## Onboarding — New Team Member

### Day 1

1. Get GitHub access (Lead Dev adds as collaborator)
2. Clone repo: `git clone https://github.com/lelekovtv-ops/piece_platform.git`
3. Read `CLAUDE.md` — project conventions
4. Read this document — team processes
5. Install tools: Node.js 20, pnpm, OrbStack (Mac) or Docker

### Day 2

6. Setup local environment:
   ```bash
   pnpm install
   cp .env.example .env.local   # Lead Dev provides secrets
   pnpm run infra               # Start Docker containers
   pnpm run dev                 # Start all services
   ```
7. Open `http://localhost:5201` — verify app works
8. Create a test PR (fix a typo, add yourself to CONTRIBUTORS)

### Day 3

9. Get first task assigned (GitHub Issue)
10. Pair session with Lead Dev or QA Lead
11. Start contributing!

### What Lead Dev provides:
- `.env.local` file with local development secrets
- Walkthrough of codebase architecture
- First task assignment

---

## Project Management

### Task Tracking: GitHub Projects

Board columns:
```
Backlog → To Do → In Progress → In Review → QA Testing → Done
```

### Task Assignment Rules

- Alex creates high-level tasks and priorities
- Lead Dev breaks tasks into technical subtasks
- QA Lead creates test tasks
- Each task has:
  - Assignee (one person)
  - Priority label
  - Estimated complexity (S / M / L / XL)
  - Acceptance criteria
  - Due date (if applicable)

### Sprint Structure (2-week sprints)

| Day | Activity |
|-----|----------|
| Monday W1 | Sprint planning (1hr) — pick tasks for sprint |
| Daily | Standup (async, Slack) |
| Friday W1 | Mid-sprint check — are we on track? |
| Thursday W2 | Code freeze — no new features, only bug fixes |
| Friday W2 | Sprint review + demo (1hr) |
| Friday W2 | Retrospective (30min) — what went well/badly |

---

## Monitoring & Incidents

### Who monitors what

| What | Who | Tool |
|------|-----|------|
| Server health | Lead Dev + Alex | Piece Monitor (menu bar app), Grafana |
| Error tracking | Lead Dev | Sentry |
| User activity | Alex | Admin dashboard, audit logs |
| Performance | Lead Dev | Grafana, Prometheus |

### Incident Response

| Severity | Who responds | Process |
|----------|-------------|---------|
| Server down | Lead Dev → Alex | 1. Investigate 2. Fix 3. Post-mortem |
| Security breach | Lead Dev + Alex | 1. Contain 2. Assess 3. Fix 4. Notify users |
| Data loss | Lead Dev + Alex | 1. Stop changes 2. Restore backup 3. Investigate |
| Feature broken | Lead Dev | 1. Hotfix if critical 2. Otherwise next sprint |

---

## Key Principles

1. **Code review everything** — no exceptions, not even "simple" changes
2. **Test before deploy** — QA signs off every release
3. **Document decisions** — write down why, not just what
4. **Communicate blockers early** — stuck for 30 min? Ask for help
5. **Own your code** — you wrote it, you support it
6. **No blame** — bugs happen, learn and fix
7. **Ship small** — small PRs, frequent deploys, less risk
