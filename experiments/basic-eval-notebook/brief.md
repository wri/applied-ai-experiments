---
title: "Basic Eval Notebook"
type: marimo
status: done
created_at: 2026-04-14
updated_at: 2026-06-10

targets: infra
themes: [evals]
tags: [marimo]

demo:
  enabled: true
  type: marimo-wasm
  build_command: "marimo export html-wasm notebooks/eval_template.py -o exports/index.html --mode edit"
  output_dir: "exports"
---

# Basic Eval Notebook

> A minimal, copy-and-modify evaluation notebook that any WRI team member can use to evaluate an LLM
> on a specific task in under an hour. Three templates: summarization (ROUGE + LLM-as-judge),
> extraction (field matching), and classification (precision/recall/F1).

## Before

### What problem or question does this address?

The lowest possible barrier to entry for evaluation practice at WRI: one notebook that shows the
pattern, for teams who aren't ready for a full harness.

Plenty of WRI team members want to evaluate their AI features but don't need a framework. They need one notebook they can copy, modify, and run — showing how to define test cases, run them through a model, score outputs, and visualize results. Without it, teams either skip evaluation or wait for the full harness.

### What does this experiment actually do?

One self-contained notebook with three eval templates baked in: summarization quality (ROUGE + LLM-as-judge), extraction accuracy (field-level matching), and classification correctness (precision/recall/F1). Ships with sample datasets, inline documentation, and a "customize this for your task" section. Tested with 3 WRI staff who have AI features but no evals.

### What signals are we looking for?

Hypothesis: one notebook lets someone with basic Python skills run a meaningful evaluation in under 60 minutes and surface at least one non-obvious quality issue.

Success = ≥3 staff complete a first eval in ≤60 min, ≥2 find a previously unknown issue, and the notebook runs unmodified on sample data.

### What are the boundaries?

1–2 days. Deliberately minimal — no framework, no CLI, no installs beyond standard data-science libraries. A stepping stone to the full eval harness, not a replacement. Three templates only.

---

## Learnings

- **A "60-minute eval" only fits in 60 minutes if nothing needs installing beyond `uv sync`.** A venv, a kernel registration, *and* an API key are three separate cliffs; a deterministic stub turns the API key into an opt-in rather than a blocker.
- LLM-as-judge faithfulness scoring needs a paired deterministic baseline (e.g. ROUGE-L) so reviewers can sanity-check the judge against a metric whose behaviour they already understand.
- Eval datasets must include at least one deliberately seeded quality issue, otherwise 'discover a non-obvious quality issue' becomes unfalsifiable on a clean test set — the failure mode is the proof the scorer works.
- **Perfect first-pass eval scores almost always mean the eval is wrong, not that the model is right.** A stub classifier scoring 1.0/1.0/1.0 was secretly tuned to match; weakening it deliberately is what makes the failure modes visible.

---

## After

**Outcome:** Inconclusive (user testing not run): shipped a single marimo notebook with three
eval templates (summarisation, extraction, classification) plus a stub fallback that runs
end-to-end without an API key; the artifact half is complete but the falsifiable validation
(three staff completing an eval in 60 minutes) is queued as follow-up.

### Signal check

- **≥3 staff finish a first eval in ≤60 min** — **Inconclusive — user testing was never run.** Three test users still need recruiting, ideally each with a real AI feature they own (queued in `notes.md`). Measuring means recruiting them and timing the sessions.
- **≥2 staff find an unknown quality issue** — **Inconclusive — same missing user testing.** The sample data does ship with deliberately seeded issues (the sarcasm and date-format cases), so the signal stays falsifiable whenever the test happens.
- **Notebook runs unmodified on sample data** — **Confirmed.** The deterministic stub fallback runs it end-to-end with no API key, and the same notebook exports to standalone HTML in the Pages deploy pipeline.

### What happened?

Shipped a marimo notebook with three eval templates, 6–8 WRI-flavoured cases each, an LLM-as-judge faithfulness scorer on Claude Haiku 4.5, and a deterministic stub fallback so it runs keyless. It exports via `marimo export html-wasm` and is wired into the Pages deploy as the experiment's demo.

The artifact half is complete. The falsifiable half — the ≤60 min / unknown-issue claims — has **not** been run, and is queued in `notes.md`.

### What would you recommend?

- **Reach for this before any full harness.** Most teams will outgrow these templates — that's the point — but eight YAML cases and one notebook is a far smaller commitment, and outgrowing it is itself a useful signal.
- **Ship every eval with at least one known-failure case**, so reviewers can confirm the scorer behaves as claimed. "The eval ran clean" is a weak claim if nobody ever saw a failure.
- **Keep LLM-as-judge behind a faithfulness-only rubric.** Open-ended "is this a good summary" judges are noisy; "does this add unsupported claims?" is binary enough to defend.

### What decisions and tradeoffs came up along the way?

- **Marimo only, dropped Jupyter.** Two versions wasn't worth the maintenance. Marimo is already a top-level dependency, the reactive cell model suits a teaching notebook, and `html-wasm` export gives a static Pages artifact free. Tradeoff: a small learning curve for Jupyter-only staff — a Colab port is the answer if that shows up in user testing.
- **Claude Haiku 4.5 as judge.** Cheap, fast, accurate enough for short-form faithfulness at small batch sizes. Tradeoff: a single-vendor judge makes the judge part of the methodology, which the README says outright.
- **Stub fallback without a key.** The notebook can be read and run before the user commits to an eval. Tradeoff: stub numbers aren't results, so the notebook prints a callout when stubs are active.
- **6–8 cases per template.** Small enough to scan by eye, big enough to register pattern failures (all date fields wrong, all sarcasm cases flipped). Larger samples are the harness's job.
- **Didn't run user testing this pass.** Building the artifact and recruiting three users with real features are different work. Shipping first makes the ask concrete — "try this with your task" — rather than abstract.
