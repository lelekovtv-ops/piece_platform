# Iron Laws — Universal

These laws apply to ALL projects regardless of tech stack. They are non-negotiable.

## Process Laws

1. **NO completion claims without fresh verification evidence.** Run the verification command, read the output, confirm the claim. "Should work" is not evidence.
2. **NO fixes without root cause investigation first.** If 3+ fix attempts fail, question the architecture, not the symptoms.
3. **NO quick fixes or bandaid patches.** Implement architecturally correct solutions. "This works for now" is technical debt.
4. **NO pausing between plan steps to ask "should I continue?"** The plan was approved. Execute it to completion. Stop only for genuine blockers.
5. **NO automatic push or deploy after completing a plan.** Only commit. Push and deploy are separate, user-initiated actions.

## Code Quality Laws

6. **NO production code without a failing test first (TDD).** Write code before the test? Delete it. Start over.
7. **NO skipping code review.** Review early, review often. "It's simple" is not a reason to skip.
8. **NO speculative code.** If a solution "might work" or "should work" — don't ship it. Either verify it works or don't write it. Every change must be a known-correct fix, not a guess.

## Communication Laws

8. **Chat with user — strictly Russian.** All responses, explanations, questions — in Russian only.
9. **Everything else — strictly English.** Code, comments, logs, error messages, commit messages, documentation, variable names.
10. **Zero Cyrillic in source files, docs, skills, or config.** The only place for Russian is chat responses to the user.
