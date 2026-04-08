# Post-Implementation Plan Audit — Core Methodology

## Overview

After implementing a plan, verify that all tasks were completed correctly, the build passes, tests pass, and architecture is compliant.

## Process

### Step 1: Plan Completion Check

1. Read the plan file from `.claude/plans/`
2. Verify EVERY checkbox is checked
3. If any unchecked — list them as findings

### Step 2: Build Verification

Run the project build. Must succeed with zero errors.

### Step 3: Test Verification

Run the full test suite. Must pass with zero failures.

### Step 4: Architecture Compliance

- Verify new code follows project patterns (check rules files)
- Verify no anti-patterns introduced
- Verify error handling follows project conventions

### Step 5: Auto-Fix

For issues found in steps 1-4:
- Fix automatically where possible
- Report what was fixed and what needs manual attention

## Output

```markdown
# Plan Audit Report

## Plan: [plan name]
## Status: PASS / FAIL

### Completion: X/Y tasks checked
### Build: PASS/FAIL
### Tests: PASS/FAIL (N tests, N failures)
### Architecture: N findings

### Auto-Fixed
- [list of auto-fixed issues]

### Requires Manual Attention
- [list of issues needing human review]
```
