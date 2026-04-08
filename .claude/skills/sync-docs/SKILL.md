# Bidirectional Documentation Sync — Core Methodology

## Overview

Verify that documentation matches actual code and vice versa. Find and fix drift.

## Process

### Step 1: Code to Docs

For each documented API/module/service:
1. Read the documentation claims
2. Read the actual code
3. Find discrepancies (missing endpoints, changed signatures, removed features)
4. List all drift

### Step 2: Docs to Code

For each code module:
1. Check if documentation exists
2. Check if documentation is accurate
3. Find undocumented code that should be documented

### Step 3: Test to Code

For each test file:
1. Check if tested code still exists
2. Check if test assertions match current behavior
3. Find untested code that should be tested

### Step 4: Report

Present all findings. Wait for user approval before making changes.

### Step 5: Fix

After approval:
- Update documentation to match code (preferred)
- Or update code to match documentation (if docs represent intended behavior)
- Never silently change both

## Rules

- **READ-ONLY analysis** until user approval
- **Prefer updating docs** to match code (code is truth)
- **Flag conflicts** where docs and code disagree on intended behavior
- **Cross-reference** all changes with related files
