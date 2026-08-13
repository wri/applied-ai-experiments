<!-- Delete whichever section doesn't apply. For other changes, delete both. -->
<!-- `just doctor` covers everything below that a machine can check. -->

## New experiment

- [ ] Branch is `exp/<slug>`, and the folder name matches
- [ ] Scaffolded with `just new-experiment` (so the frontmatter is filled, not `CHANGEME`)
- [ ] `brief.md` "Before" is filled: the problem **and the decision it informs**, what it
      does, the signals, the boundaries
- [ ] At least one signal has a falsifiable threshold with a number — `>=3 teams`,
      `p95 < 2s`, `N=20` — not "users like it"
- [ ] `just doctor` passes

## Experiment close-out

- [ ] "After" opens with a `### Signal check` answering **each** signal from "Before" —
      Confirmed / Refuted / Inconclusive — because X ("we didn't measure it" is valid, but
      say what measuring would take)
- [ ] "After" filled: what happened / what you recommend / decisions and tradeoffs
- [ ] `**Outcome:**` line written, signal-prefixed, one sentence
- [ ] `## Learnings` bullets each read on their own, without this experiment's context
- [ ] `status: done` and `updated_at` today
- [ ] README de-staled — findings live in the brief, not here
- [ ] `just doctor` and `just validate-strict` pass; `just generate-index` output committed

<!-- Reminder: description, results.summary and results.learnings are GENERATED from the
     brief body. Write the lede blockquote, the Outcome line, and the Learnings bullets —
     never the frontmatter copies. -->

## To publish

Merging does **not** deploy. The commit that lands on `main` must contain `[deploy]` —
squash-merge with it in the subject, or run the deploy workflow from the Actions tab.

---

<!-- Anything reviewers should know: what to look at first, what's deliberately out of scope. -->
