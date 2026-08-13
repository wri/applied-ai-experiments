# Comparing LLM Models for WRI Tasks

> See [brief.md](./brief.md) for context, signals, and findings.

## In flight

Held here rather than in `brief.md` because this experiment is still `started`:
its "After" section is unwritten, and the hub renders any filled After as an
**Outcome** panel, which would misrepresent work in progress. At close-out these
notes move into the brief — the decisions into "What decisions and tradeoffs came
up along the way?", the open threads into "What would you recommend?".

**Where it stands.** A few test queries have been tried; the next step is a set of
tasks specific to WRI (still to be identified). The goal is to demo this at least
once for iteration — to the applied AI community, perhaps — before closing out.

**Decisions so far.** The working record with rationale; the takeaways that
generalize beyond this experiment live in the brief's
[Learnings](./brief.md#learnings).

- **LiteLLM over anyLLM** — better telemetry (token usage in particular) and direct
  Langfuse integration hooks.
- **OpenRouter for model access**, to cut the number of API keys needed to run it.
- **Tried OpenCode Zen via the OpenAI SDK first**, then moved off it; retained for
  reference at `notebooks/archive_compare_models_with_zen.py`.

**Open threads.** Examine system prompt versus user prompt; update the model
registry to include frontier models such as Claude.

## What's in here
├── notebooks/
│   ├── compare_models.py                      # Primary notebook
│   ├── archive_compare_models_with_zen.py  
│   └── util.py  
├── data/  
└── exports/  

## Setup

### Prerequisites
- Python 3.13+
- `uv` must be installed
- An [OpenRouter](https://openrouter.ai) API key
- A [Langfuse](https://langfuse.com) account (for observability)

Recommended:
- use .env or mise to manage env variables

### Environment Variables

Set the following before running:

```bash
OPENROUTER_API_KEY=...       # Required — unified LLM access via OpenRouter
LANGFUSE_PUBLIC_KEY=...      # Required — Langfuse observability
LANGFUSE_SECRET_KEY=...      # Required
LANGFUSE_HOST=...            # Optional — defaults to https://cloud.langfuse.com
OPENAI_API_KEY=...           # Optional — only needed for direct OpenAI models
```

If you use mise (https://mise.jdx.dev/), you can store these in a local mise.toml (do not commit it).

## Install & Run

Start the notebook.

Suggested command to start the notebook from the experiment directory (`compare-models-for-wri-tasks/`):
```sh
uv run --with marimo marimo edit --sandbox notebooks/compare_models.py
```

Then:
* Open the link to view the notebook in your browser.
* Follow along.

The available models are specified in `notebooks/util.py`. To add a model, update `MODEL_REGISTRY`.
