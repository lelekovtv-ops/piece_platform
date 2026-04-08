# Fix Audit Findings — Core Methodology

## Overview

Deep remediation of ALL audit findings — warnings, info, tech debt, recommendations. Fixes everything architecturally, no shortcuts.

## Process

### Step 1: Load Audit Report

Find the most recent audit report. Read it completely.

### Step 2: Prioritize Findings

Order by severity:
1. **Critical** — fix immediately (security, data loss)
2. **Warning** — fix before proceeding (broken patterns, anti-patterns)
3. **Info** — fix for cleanliness (style, minor improvements)
4. **Tech Debt** — fix architecturally (not bandaids)

### Step 3: Fix Each Finding

For each finding:
1. Read the affected code
2. Understand WHY it's a finding (not just WHAT)
3. Design the proper fix (not the fastest)
4. Implement with TDD where applicable
5. Verify the fix doesn't break anything
6. Mark as resolved

### Step 4: Re-Audit

After all fixes:
1. Run the full audit again
2. Verify zero critical and warning findings remain
3. Report remaining info items (if any)

## Rules

- **No partial fixes** — fix the root cause, not the symptom
- **No suppression** — don't disable linter rules or add ignore comments
- **No deferral** — "fix later" means "never fix". Fix now.
- **Test each fix** — run tests after every change
