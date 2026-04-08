# Update Documentation — Core Methodology

## Overview

Update project documentation after code changes. Ensures CLAUDE.md, rules, and skills stay accurate.

## Process

### Step 1: Identify Changes

```bash
git diff --stat HEAD~5
git log --oneline -5
```

### Step 2: Check Documentation Impact

For each changed area:
1. Does CLAUDE.md reference it? Update if needed.
2. Do any rule files reference it? Update if needed.
3. Do any skill files reference it? Update if needed.

### Step 3: Update

- Update file paths if files were moved/renamed
- Update command examples if commands changed
- Update architecture descriptions if structure changed
- Update port numbers if ports changed
- Remove references to deleted code

### Step 4: Verify

- Read each updated doc section
- Confirm it matches current code
- No stale references remain

## Rules

- **Only update what changed** — don't rewrite entire documents
- **Preserve formatting** — match existing style
- **No speculation** — only document what exists in code now
- **Cross-reference** — if you update one doc, check related docs
