# Writing Plans — Core Methodology

## Overview

When creating implementation plans, follow this methodology. Create comprehensive plans assuming the engineer lacks codebase context. Document everything needed: files to modify, code samples, testing approaches, validation methods.

**Prerequisite:** Design approved via brain skill (or user provided clear requirements).

## Phase 0: Requirements Clarification (MANDATORY)

<HARD-GATE>
Do NOT start writing the plan until you have asked clarifying questions and understood the full scope.
"This is too simple for questions" — is the signal to ask MORE questions, not fewer.
</HARD-GATE>

Before writing ANY plan:

1. **Read related code** — explore the area that will be changed
2. **Ask 3-7 clarifying questions** covering:
   - Edge cases: "What happens when X fails / is empty / exceeds limit?"
   - Scope boundaries: "Should this also handle Y or is that separate?"
   - Existing patterns: "I found Z pattern in the codebase — follow it or change it?"
   - User impact: "Who uses this? What's the expected flow?"
   - Integration: "Which other services/modules are affected?"
3. **Wait for answers** — do NOT proceed without responses
4. **Summarize understanding** — restate requirements in your own words, get confirmation
5. **Only then** proceed to scope validation and task writing

### Red Flags — You're Skipping Questions
| Thought | Reality |
|---------|---------|
| "Requirements are clear" | They seem clear. Ask about edge cases. |
| "I'll figure it out during implementation" | No. Unclear requirements = rework. Ask now. |
| "This is a small change" | Small changes in wrong direction = waste. Verify direction. |
| "User will tell me if I'm wrong" | User expects YOU to find the gaps. |

## Scope Validation

If spec covers multiple subsystems, recommend splitting into independent plans — one per subsystem. Each plan must produce working, testable software independently.

## File Structure Definition

Before tasks, map created/modified files with clear responsibilities:
- One responsibility per file
- Follow project conventions for directory structure

## Task Granularity

Single action per step (2-5 minutes):
- Write failing test
- Verify failure
- Implement minimally
- Verify passing
- Commit

## Key Rules

- **Exact file paths** — always
- **Complete code samples** — not descriptions or pseudocode
- **Exact commands** with expected outcomes
- **TDD steps** in every task
- **Audit step** every 5 tasks
- **Final step** always: "Final audit: build + lint + tests + docs"

## Mandatory Final Tasks (EVERY plan must include these)

<HARD-GATE>
Every plan MUST end with these tasks before the final audit step.
No plan is complete without test coverage tasks. No exceptions.
</HARD-GATE>

### Required final tasks (in this order):

**Task N-2: Unit Test Coverage**
- Write/update tests for all new/modified code
- Update existing tests if function signatures or behavior changed
- Verify: full test suite passes
- Check: every new file has corresponding tests

**Task N-1: Integration/E2E Test Consistency Check**
- For each changed page/endpoint — read the corresponding test file
- If test references old selectors, text, or flow — update it
- If no test exists for a changed area — create a skeleton test file

**Task N (final): Verification + Final Audit**
- Build the project successfully
- Run linter — zero warnings
- Run full test suite — all pass
- Final code audit per audit workflow rules

## Review Process

1. Send plan to plan-document-reviewer subagent if available
2. If issues: fix and re-dispatch entire plan
3. If approved: proceed to execution
4. Max 3 iterations, then escalate to user

## Plan Persistence

After the plan is approved, save a copy to the project:

1. Copy to `.claude/plans/` in the project repo
2. Use naming: `PLAN-{YYYY-MM-DD}-{short-kebab-name}.md`
3. This is the canonical copy — committed with the code as implementation history

## Execution Handoff

After plan is ready, execute using executing-plans methodology.
