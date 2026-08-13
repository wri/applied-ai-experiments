# Basic Eval Notebook

> See [brief.md](./brief.md) for context, signals, and findings.

## Setup

### Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) for dependency management
- Optional: `ANTHROPIC_API_KEY` in your environment for real model calls
  (without it, the notebook runs deterministic stubs so you can see the flow)

### Install & run

```bash
cd experiments/basic-eval-notebook
uv sync
uv run marimo edit notebooks/eval_template.py
```

To run as a script (no UI, just executes top-to-bottom and writes
`outputs/run_<timestamp>.json`):

```bash
uv run python notebooks/eval_template.py
```

To export the notebook as a static HTML page (used by the deploy pipeline):

```bash
uv run marimo export html-wasm notebooks/eval_template.py -o exports/index.html --mode edit
```

## What's in here

```
basic-eval-notebook/
├── brief.md                  Before / After narrative
├── README.md                 This file
├── notes.md                  Working notes and open questions
├── pyproject.toml            uv-managed deps
├── notebooks/
│   └── eval_template.py      The notebook — three eval templates in one file
├── data/
│   ├── summarization.yaml    6 cases (climate / restoration / policy)
│   ├── extraction.yaml       6 cases with deliberate ambiguities
│   └── classification.yaml   8 cases including sarcasm and conceded clauses
├── src/
│   ├── runner.py             call_summarise / call_extract / call_classify
│   └── judge.py              LLM-as-judge faithfulness scorer
├── exports/                  Static HTML build target (gitignored)
└── outputs/                  Per-run JSON results (gitignored)
```

## The three templates

| Template | Scorer | What it surfaces |
|---|---|---|
| **Summarisation** | ROUGE-L + LLM-as-judge faithfulness | Cases where output looks lexically close to reference but adds or misattributes claims |
| **Extraction** | Field-level exact match | Format ambiguities (date formats, currency notation, number canonicalisation) |
| **Classification** | Macro-averaged precision / recall / F1 | Surface-sentiment failures: sarcasm, hedged claims, conceded clauses |

Each dataset has at least one **deliberately seeded quality issue** so
the success metric ("discover a non-obvious quality issue") is
observable on the canonical sample, even before you swap in your own
data.

## Customising for your task

1. Pick a template that matches your task shape.
2. Replace the corresponding `data/<task>.yaml` with your own cases —
   keep the schema (each case needs `id`, `input`, `expected`, optional
   `tags` and `notes`).
3. If your task is not Anthropic-served, replace the relevant function
   in `src/runner.py`. The interface is intentionally minimal: one
   function per template, takes input + returns output.
4. Re-run the notebook. The score table updates automatically.
