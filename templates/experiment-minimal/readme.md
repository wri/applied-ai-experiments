# {{ Experiment Title }}

> Short summary (1–3 sentences). Framing lives in [`brief.md`](./brief.md) and canonical metadata in [`info.yaml`](./info.yaml).



## Overview

A slightly more detailed overview of:

- What this experiment is doing.
- Who it’s for.
- What we hope to learn.

For full context, see [`brief.md`](./brief.md).

---

## How to Run This Experiment

> Delete or trim sections that don’t apply for non-code experiments.

### Prerequisites

- Language/runtime (e.g. Python 3.11, Node 22).
- Any external services or keys (place examples in `.env.example`).
- Data requirements (where to put files, how to access datasets).

### Setup

```bash
# Example for Python experiments
uv sync
source .venv/bin/activate 
```

### Running

```bash
# Example command(s) to run the main workflow
python src/main.py
# or
npm install
npm run dev
```

Describe:

- Inputs (files, APIs, prompts).
- Outputs (files, logs, metrics, dashboards).

### Evaluation, Logging & Outputs
- Where evaluation scripts live.
- How to run them.
- Where results are written (e.g. results/, dashboards).
- Any conventions for logging or eval artifacts.

### Decisions & Learnings Log

Use this as a lightweight log of important decisions and learnings.
- YYYY-MM-DD – Decision or learning, and why it matters.
- YYYY-MM-DD – Another note.

### Future Work
- What we’d do next if this experiment shows promise.
- How this could roll into a product, tool, or broader system.
- Follow-up experiments or variations to explore.