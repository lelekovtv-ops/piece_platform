# Brainstorming — Core Methodology

## Overview

Design before you build. Ask questions before you code.

**Core principle:** Understand the problem completely before proposing solutions.

## The Hard Gate

```
NO IMPLEMENTATION WITHOUT DESIGN APPROVAL
```

You may NOT write production code until:
1. Requirements are understood
2. Approach is designed
3. User has approved the design

## The Process

### Phase 1: Understand

Ask Socratic questions to uncover:
- **What** exactly needs to happen?
- **Who** will use this? (user roles, API consumers)
- **Why** is this needed? (business driver, user pain)
- **Where** does this fit? (which service, which module)
- **When** are there time constraints?

### Phase 2: Explore Existing Code

Before proposing anything:
- Search for similar patterns in the codebase
- Check if utilities/helpers already exist
- Review relevant rule files for constraints
- Identify integration points

### Phase 3: Design

Produce a design document covering:

```markdown
# Feature: [Name]

## Goal
[One sentence]

## Architecture Decision
- Where does this live? (service, module, package)
- What data stores are involved?
- What events/messages are published or consumed?
- What API endpoints are needed?

## Data Model
[Schemas or types]

## API Endpoints
[Routes with request/response shapes]

## Event Flow
[Events published/subscribed, if applicable]

## Edge Cases
[What could go wrong]
```

### Phase 4: Review

Dispatch spec reviewer subagent if available. Max 3 iterations, then escalate to user.

### Phase 5: Approval

Present design to user. Wait for explicit approval before proceeding.

After approval:
- Use writing-plans methodology to create implementation plan
- Or proceed directly if scope is small

## Anti-patterns

- Jumping to code before understanding requirements
- Proposing solutions in Phase 1 (understand first)
- Skipping existing code search (reinventing the wheel)
- Starting implementation without user approval
