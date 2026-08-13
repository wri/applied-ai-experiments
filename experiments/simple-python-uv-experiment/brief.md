---
# ---- Required ----
title: "Simple Python UV experiment"
type: marimo
status: paused

# ---- Recommended ----
created_at: 2025-11-13
updated_at: 2026-07-20

# ---- Classification ----
targets: infra
themes:
  - prototyping
tags:
  - marimo
  - embeddings

# ---- Demo (when there's something to show) ----
demo:
  enabled: false
  type: marimo-wasm
  build_command: "marimo export html-wasm experiment_one.py -o exports/index.html"
  output_dir: "exports"
---

# Simple Python UV experiment

> Self-contained marimo notebook exploring the Resource Watch API, using uv for dependency management
> with inline script metadata.

*Before section retrofitted 2026-07-24 from the README  — this experiment predates the brief.md convention.*

## Before

### What problem or question does this address?

Can a Python experiment here be self-contained enough that a colleague runs it with one command and
no environment setup? This tested `uv` + marimo inline dependencies against the Resource Watch API.

Every new Python experiment here re-litigated its own environment setup — a virtualenv, a `requirements.txt`, a README section explaining both. Anyone picking up someone else's notebook paid that cost before seeing any output.

This tells contributors whether `uv`'s inline script metadata plus marimo's sandbox mode is a good enough default to skip environment plumbing entirely, and gives the repo a concrete starting point to copy.

### What does this experiment actually do?

The smallest possible working Python experiment: one data file (`resourcewatch_datasets.csv`) and one Python file (`experiment_one.py`) declaring its dependencies inline via PEP 723, reading the Resource Watch API. Run end to end through `uvx marimo edit --sandbox`, confirming nothing else is needed.

### What signals are we looking for?

- A colleague with only `uv` installed runs it in **exactly 1 command** — no `pip install`, no venv, no `requirements.txt`.
- **Under 2 source files** plus data, so it reads in one sitting and copies as a starting point.
- Exports to a static WASM HTML artifact with **0** code changes, so one file serves both local exploration and a shareable build.

### What are the boundaries?

1–2 days. Not covering multi-file packages, dependency pinning for long-lived experiments, or CI notebook execution. One API only — this is about the runner, not the data.

---

## Learnings

_None published, deliberately._ This is a demonstrator of the repo's own file structure, not an
experiment with a transferable finding — everything it settled is about how this repository works,
and the hub's Learnings page is for takeaways another team could act on. What was learned is in
"What happened?" and "What would you recommend?" below, which still render on the experiment page.

---

## After

**Outcome:** Confirmed (mechanics only): `uv` inline PEP 723 metadata plus `marimo edit
--sandbox` makes a single-file Python experiment runnable with one command and no environment
setup; the "reusable starting point" half is superseded by the scaffolded marimo template.

*Written at pause, 2026-07-20.*

### Signal check

- **1 command, no setup** — **Confirmed.** `uvx marimo edit --sandbox experiment_one.py` is the whole setup story. PEP 723 carried every dependency.
- **Under 2 source files** — **Confirmed.** One Python file, one CSV.
- **Static export with 0 code changes** — **Inconclusive.** `demo.enabled` is `false` and the `html-wasm` build never ran in a deploy, so the claim is untested. Measuring means enabling the demo and running `just build-demos` once — about an hour, mostly checking the export still resolves its inline dependencies in WASM.

### What happened?

The single-file `uv` + marimo path worked immediately and needed no defending. The Resource Watch portion stayed deliberately thin — enough to prove data flows, not enough to be an analysis. The output was the shape, not the findings: self-contained costs almost nothing.

Where it fell short of its own framing: it was written as a template others would copy, and nothing has. `.github/templates/marimo/` became the real starting point, because it carries the metadata contract and the scaffolder fills it in. A hand-rolled example competes with generated scaffolding and loses.

### What would you recommend?

**Stop** maintaining this as a template — `.github/templates/marimo/` fills that role and is CI-checked by `just smoke-scaffold`. **Adopt** the `uv` inline metadata pattern as the default for single-file Python experiments; that part is settled. Keep this directory as a worked reference until someone needs the space.

### What decisions and tradeoffs came up along the way?

- **Inline PEP 723 over `requirements.txt`.** Weaker reproducibility without a lock file — right trade for a 1–2 day experiment, wrong for anything long-lived.
- **`--sandbox` over a shared venv.** Slower first run, but it neither pollutes nor depends on the caller's environment. Correct for a demonstrator whose whole point is "no setup".
- **Paused, not archived.** Nothing failed; it just stopped being the best answer to its own question once templates existed. Archiving would imply the approach was wrong.
