# Notes: Basic Eval Notebook

## Open Items

- [ ] Recruit 3 test users, ideally each owning a real AI feature, and time their first eval.
      This is the one unrun half of the experiment — the `≤60 min` and `finds an unknown issue`
      signals are both Inconclusive until it happens. See the Signal check in [brief.md](./brief.md).

## Resolved questions

These were open during scoping and are settled — kept for the reasoning, not as live questions.
The full rationale is in the brief's "What decisions and tradeoffs came up along the way?".

- **Jupyter, Marimo, or both?** → Marimo only. Two versions wasn't worth the maintenance, and
  `html-wasm` export gives a static Pages artifact for free.
- **What Python skill do we assume, and can we avoid setup?** → Nothing beyond `uv sync`. A
  deterministic stub fallback makes the API key opt-in rather than a prerequisite.
- **Which judge model, and how do we handle the API key?** → Claude Haiku 4.5, faithfulness-only
  rubric, behind the same stub fallback.

## Dependencies

- No hard prerequisites — this is one of the most independent experiments.
- Feeds the eval-harness and `cost-quality-frontier` ideas in [docs/backlog.md](../../docs/backlog.md)
  as the low-commitment entry point to more structured evaluation.

## Ideas

- This notebook could be the recommended first step in the experiments process — "before you
  start, evaluate."
- Sample data could later be drawn from the WRI-bench task set once that exists (see backlog).
- Consider a Google Colab version for zero-install access — the answer if the Marimo learning
  curve shows up in user testing.

## Review comments carried forward

- "Discover a non-obvious quality issue" is hard to guarantee — it depends which AI features the
  test users bring. Mitigated by shipping deliberately seeded issues in the sample data (the
  sarcasm and date-format cases), so the signal stays falsifiable regardless.
