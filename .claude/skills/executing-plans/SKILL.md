# Executing Plans — Core Methodology

## Overview

Load plan, review critically, execute all tasks, report when complete.

## The Process

### Step 1: Load and Review Plan

1. Find the plan: check `.claude/plans/` in the project first (canonical), then `~/.claude/plans/` (ephemeral)
2. Read the plan file completely
3. Review critically — identify questions or concerns
4. If concerns: raise them with user before starting
5. If no concerns: create task list and proceed

### Step 2: Execute Tasks

For each task:
1. Mark as in_progress
2. Follow each step exactly (plan has bite-sized steps)
3. Run verifications as specified
4. Run full test suite after each task
5. Mark as completed

### ABSOLUTE RULE: Zero Skipped Steps

Every step in the plan MUST be executed. This rule is non-negotiable.

- **NEVER skip a step** because it's "complex" or "would need its own plan"
- **NEVER defer a step** to "a future task" or "separate PR"
- **NEVER simplify a step** by doing a subset of what the plan says
- **If a step is hard**, break it into sub-steps and complete each one
- **If a step seems impossible**, explain WHY before moving on — never silently skip

The plan was reviewed and approved as a whole. Skipping steps makes the entire plan invalid.

#### Red Flags — You're About to Skip
| Thought | Reality |
|---------|---------|
| "This needs its own plan" | No. It's IN this plan. Do it now. |
| "I'll handle this separately" | The plan already handles it. Execute. |
| "This is too complex for one step" | Break into sub-steps. Still do it now. |
| "This part isn't critical" | If it's in the plan, it's critical. |
| "I can come back to this" | You won't. Do it now. |

### Intermediate Audits

Every 5 tasks, run intermediate audit:
- Linter — 0 errors, 0 warnings
- Full test suite — all tests pass
- Quick check for anti-patterns

### Step 3: Complete Development

After all tasks complete and verified:

1. **Lint + tests** — must pass
2. **Build verification** — project builds successfully
3. Auto-commit all changes (conventional commits, English)
4. **NEVER push or deploy automatically** — push and deploy are ALWAYS separate commands initiated by the user
5. Report: what was done, audit results, verification results, commit hash

## Autonomous Execution — NEVER Pause Without Reason

<HARD-GATE>
Execute ALL tasks from start to finish WITHOUT stopping to ask "should I continue?"
The plan was approved. Approval means: execute everything. No confirmation loops.
</HARD-GATE>

### When to STOP (only these reasons):
- **Blocker:** dependency missing, service down, tool unavailable
- **Ambiguity:** plan step is genuinely unclear (not just complex)
- **Failure:** same verification fails 3+ times after different fixes
- **Architecture decision:** fix requires choosing between incompatible approaches

### When to NEVER STOP:
- After completing a task — proceed to the next one immediately
- After completing a phase — proceed to the next phase
- After intermediate audit — fix issues and continue
- When a task "feels complex" — break it down and do it
- To ask "should I continue?" — YES, always continue

### Red Flags — You're About to Pause Unnecessarily
| Thought | Reality |
|---------|---------|
| "Let me check with the user" | Was the plan approved? Then execute it. |
| "This step is done, should I continue?" | Yes. Always yes. Next task. |
| "I should summarize progress" | Summarize AFTER all tasks are done. |
| "The user might want to review" | They'll review at the end. Keep going. |

## Fix Quality — No Hacks, No Shortcuts

When fixing bugs or errors during plan execution:

1. **Investigate root cause** — read the surrounding code, understand WHY it broke
2. **Consider the wider context** — does this pattern exist elsewhere?
3. **Design the proper solution** — not the fastest, but the correct one
4. **Implement once, correctly** — no "temporary fix" that becomes permanent

### Red Flags — You're Writing a Hack
| Sign | Proper Approach |
|------|----------------|
| Adding a special case / if-check for one scenario | Fix the general logic |
| Catching and swallowing an error | Fix the source of the error |
| Hardcoding a value that should be dynamic | Make it dynamic |
| Commenting out code that "doesn't work" | Fix or remove it properly |
| "This works for now" | Make it work correctly, period |
| Fix is under 3 lines for a complex bug | You're probably masking it |
