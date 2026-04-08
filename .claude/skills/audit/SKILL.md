# Code Audit — Core Methodology

## Overview

Systematic audit process to verify code quality, security, and architecture compliance before changes are merged.

## Audit Steps

### Step 1: Hardcoded Secrets Scan

Search the entire codebase for hardcoded secrets. Highest priority check.

**Scan for:**
- Database connection strings with credentials
- API keys and tokens assigned to string literals
- Passwords and secrets in code (not env references)
- `.env` files that should not be committed

**Expected:** Zero matches. All secrets must be in environment variables.

### Step 2: Error Handling Verification

- [ ] All async handlers use proper error handling (try/catch or framework error middleware)
- [ ] Error responses follow project's standard format
- [ ] Proper HTTP status codes / error codes used
- [ ] No error responses leak stack traces in production
- [ ] Process/runtime error handlers present in entry points

### Step 3: Event/Message Validation

- [ ] All events/messages created via validated factories or schemas
- [ ] No inline event object creation without validation
- [ ] Every event includes correlation/trace ID
- [ ] Event schemas match between publisher and consumer

### Step 4: Data Access Pattern Verification

- [ ] Data access follows project's isolation patterns (multi-tenancy, scoping)
- [ ] No direct database driver imports outside data access layer
- [ ] Data isolation enforced (no cross-tenant/cross-scope access)
- [ ] Index creation centralized (not in route/command handlers)

### Step 5: Logging Compliance

- [ ] No debug logging statements in production code (console.log, println!, dbg!)
- [ ] All logging uses project's structured logger
- [ ] Log messages include structured context
- [ ] No sensitive data in log messages

### Step 6: Build/Container Security

- [ ] Base images use minimal variants (alpine, slim, distroless)
- [ ] Health check endpoint present in every service
- [ ] No secrets baked into images or build artifacts
- [ ] Health checks configured in orchestration (Docker Compose, systemd, etc.)

### Step 7: Linter Strict Compliance

- [ ] Linter reports 0 errors AND 0 warnings
- [ ] Zero linter-disable comments in codebase
- [ ] All warnings fixed — not suppressed

### Step 8: Test Coverage Verification

- [ ] All tests pass
- [ ] New code has corresponding tests
- [ ] Test files follow project's testing conventions
- [ ] No skipped tests without documented reason
- [ ] No real secrets or API keys in test fixtures

## Audit Report Format

```markdown
# Audit Report — [Date]

## Summary

- **Areas scanned:** N
- **Critical issues:** N
- **Warnings:** N
- **Info:** N

## Findings

### Critical
1. [Finding with file path and line number]

### Warnings
1. [Finding with file path]

### Info
1. [Finding]

## Recommendations
1. [Specific actionable recommendation]
```

## Plan Audit Rules

Every implementation plan MUST include:

- **Last step:** "Final audit: build + lint + tests + docs"
- **For plans with 5+ steps:** intermediate audits every 5 steps
- Audit cannot be skipped even if "changes are minor"
- Plan cannot be marked completed without passing audit
- Tech debt found during audit goes into plan's "Tech Debt Discovered" section
