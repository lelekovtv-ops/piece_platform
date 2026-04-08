# Systematic Debugging — Core Methodology

## Overview

Random fixes waste time and create new bugs.

**Core principle:** Find root cause before fixing anything.

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If 3+ fix attempts fail, STOP — question the architecture, not the symptoms.

## Four-Phase Process

### Phase 1: Root Cause Investigation

1. **Read error messages carefully** — they usually tell you exactly what's wrong
2. **Reproduce consistently** — can you trigger it reliably?
3. **Check recent changes** — `git log --oneline -10`, `git diff`
4. **Gather diagnostics** — logs, stack traces, state at failure point
5. **Trace data flow backward** — from symptom to source

### Phase 2: Pattern Analysis

1. **Find working examples** — does similar code work elsewhere?
2. **Compare completely** — diff working vs broken
3. **Identify differences** — what changed?
4. **Check dependencies** — package versions, config changes

### Phase 3: Hypothesis and Testing

1. **Form ONE hypothesis** based on evidence
2. **Make ONE minimal change** to test it
3. **Verify** — did it fix or change the behavior?
4. **If wrong** — revert, form next hypothesis

### Phase 4: Implementation

1. **Write failing test** reproducing the bug (TDD)
2. **Implement single fix** addressing root cause
3. **Verify** — test passes, no regressions
4. **Run full suite**

## Red Flags — STOP

- Proposing solutions before understanding the problem
- Multiple changes at once ("try this and this and this")
- 3+ failed fixes — question architecture
- "It works now" without understanding why
- Fixing symptoms instead of root cause

## The Bottom Line

Understand FIRST. Fix SECOND. Verify THIRD.
