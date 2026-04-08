# Code Review — Core Methodology

## Overview

Dispatch code-reviewer subagent to catch issues before they cascade.

**Core principle:** Review early, review often.

## When to Request Review

**Mandatory:**
- After each task in subagent-driven development
- After completing major feature
- Before merge to main branch

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

## How to Request

### 1. Get Git SHAs

```bash
BASE_SHA=$(git merge-base HEAD <main-branch>)
HEAD_SHA=$(git rev-parse HEAD)
```

### 2. Dispatch Code-Reviewer Subagent

Provide:
- What was implemented
- Plan or requirements reference
- Base and head SHAs
- Brief summary

### 3. Act on Feedback

- Fix **Critical** issues immediately
- Fix **Important** issues before proceeding
- Note **Minor** issues for later
- Push back if reviewer is wrong (with reasoning)

## Integration with Workflows

| Workflow | When to Review |
|----------|---------------|
| Subagent-Driven Development | After EACH task |
| Executing Plans | After each batch (3-5 tasks) |
| Ad-Hoc Development | Before merge |

## Red Flags

- **Never** skip review because "it's simple"
- **Never** ignore Critical issues
- **Never** proceed with unfixed Important issues
