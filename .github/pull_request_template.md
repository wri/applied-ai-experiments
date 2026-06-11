<!-- Delete whichever checklist doesn't apply. For other changes, delete both. -->

## New experiment

- [ ] `slug` in `info.yaml` matches the folder name
- [ ] Scaffolded from a current template (`just new-experiment`) — has `schema_version`
- [ ] `brief.md` "Before" section filled (problem, what it does, signals, boundaries)
- [ ] Signals include a falsifiable threshold with a number (e.g. `>=3 teams`, `p95 < 2s`, `N=20`)
- [ ] `owner` set (`@github-handle` or team name)
- [ ] `just validate` passes

## Experiment close-out

- [ ] `brief.md` "After" section filled: what happened / learned / recommend / decisions & tradeoffs
- [ ] `info.yaml`: `status: completed`, `results.summary`, `results.lessons` (2–5 standalone bullets)
- [ ] README updated (decisions log, how to run)
- [ ] Demo still builds, if there is one
- [ ] `just validate && just generate-index` run, outputs committed
- [ ] L2+: peer review done (see [docs/governance.md](../docs/governance.md))

---

<!-- Anything reviewers should know: what to look at first, what's deliberately out of scope. -->
