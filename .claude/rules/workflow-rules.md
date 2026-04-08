# Workflow Rules

Behavioral rules extracted from methodology skills. These are non-negotiable process constraints.

## Verification Before Completion

NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.

Before ANY completion claim, success statement, or satisfaction expression:

1. **IDENTIFY:** What command proves this claim?
2. **RUN:** Execute the FULL command (fresh, complete)
3. **READ:** Full output, check exit code, count failures
4. **VERIFY:** Does output confirm the claim?
5. **ONLY THEN:** Make the claim

| Claim | Command | Expected |
|-------|---------|----------|
| Tests pass | `pnpm exec vitest run` | 0 failures |
| Lint clean | `pnpm run lint` | 0 errors, 0 warnings |
| Build succeeds | `pnpm run build` | exit 0 |
| Service healthy | `curl http://localhost:{port}/health` | `{"status":"healthy"}` |

Red flags — STOP if you catch yourself thinking:
- "should work now", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Done!")
- "I'm confident" — confidence is not evidence
- "Just this once" — no exceptions
- "Linter passed" — linter is not tests
- "Agent said success" — verify independently
- "All phases complete" — re-read the plan first
- Bundling 5+ plan items into 1 task — each plan item = 1 task

## Plan Completion Integrity

When executing a plan, NEVER claim completion without:

1. **Task-per-item mapping** — every plan sub-item has its own tracked task
2. **Plan reconciliation** — re-read the entire plan, verify every item against task list
3. **File existence check** — every file the plan says to create must exist
4. **Registration check** — every new module/route/middleware is wired in
5. **Honest status** — "partial" if anything remains, never "completed" for 95%

Bundling multiple plan phases into fewer tasks is the #1 cause of incomplete execution.
If the plan has 30 items, create 30 tasks. Not 8.

## Agent Delegation Verification

After ANY subagent completes work:

1. Read the files the agent created/modified — don't trust the summary
2. Verify registration (imports, route mounting, middleware wiring)
3. Run build + tests AFTER agent work
4. "Agent reported success" is NOT evidence — only passing builds/tests are evidence

## Code Review Response Rules

When receiving code review feedback:

1. **READ** complete feedback without reacting
2. **VERIFY** suggestion against codebase reality before implementing
3. **EVALUATE** — is it technically sound for THIS codebase?
4. **IMPLEMENT** one item at a time, test each

**Forbidden responses:** "You're absolutely right!", "Great point!", "Excellent feedback!" or any performative agreement. Instead: restate the technical requirement, ask clarifying questions, or just start working.

**YAGNI check:** If reviewer suggests "implementing properly", grep codebase for actual usage. If unused — remove it (YAGNI), don't improve it.

**Push back when:** suggestion breaks existing functionality, reviewer lacks full context, violates YAGNI, technically incorrect for this stack, or conflicts with `.claude/rules/`.

## Parallel Agent Constraints

When dispatching multiple agents:

- **One domain per agent** — each agent gets one service/package scope
- **Agents MUST NOT modify files in `packages/` simultaneously** — handle shared package changes separately after agents complete
- **No shared state** — only use parallel agents when problems can be understood independently
- **After agents return:** review summaries, check for conflicts (`git diff --stat`), run full test suite

## Branch Completion Rules

When finishing work on a branch:

- **Tests must pass** before presenting completion options — never proceed with failing tests
- **Verify on merged result** — if merging locally, run tests AFTER merge (not just on feature branch)
- **Never delete work** without explicit user confirmation
- **Never force-push** without explicit user request

## Git Worktree Rules

When creating git worktrees:

- **Copy `.env.local`** when creating worktrees: `cp ../../.env.local .env.local 2>/dev/null || true`
- **Verify directory is gitignored** before creating: `git check-ignore -q .worktrees 2>/dev/null`
- If NOT ignored — add to `.gitignore` and commit before proceeding
- **Run baseline tests** (`pnpm exec vitest run`) after worktree setup — never skip
- **Always run `pnpm install`** after creating worktree
