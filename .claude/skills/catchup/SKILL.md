# Catchup — Core Methodology

## Overview

Restore context after /clear or new session. Shows recent changes, active plans, branch status.

## Process

### Step 1: Branch and Status

```bash
git branch --show-current
git status --short | head -20
```

### Step 2: Recent Commits

```bash
git log --oneline -5 --format='%h %s (%ar)'
```

### Step 3: Changes in Recent Commits

```bash
git diff --stat HEAD~5 2>/dev/null || git diff --stat $(git rev-list --max-parents=0 HEAD)
```

### Step 4: Uncommitted Changes

```bash
git diff --stat
git diff --cached --stat
```

### Step 5: Active Plans

```bash
grep -rl 'Status: active' .claude/plans/ 2>/dev/null
```

If found — read each plan file fully.

### Step 6: Output Summary

```
## Context Restored

### Branch
{current branch} — {ahead/behind main if applicable}

### Recent Commits
{list from Step 2}

### Uncommitted Changes
{from Step 4, or "None"}

### Affected Areas
{based on file paths from Steps 3-4}

### Active Plans
{from Step 5, or "No active plans"}

### Recommendation
{what to do next — based on uncommitted changes and plans}
```

## Rules

- All information from git — no running services needed
- If no plans found — omit plans section
- Focus on actionable summary — what was done, what remains
