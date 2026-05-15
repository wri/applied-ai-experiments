# Comparing LLM Models for WRI Tasks
Interactive tool for querying multiple LLMs with the same prompt in parallel and comparing their responses, latency, token counts, and cost. See [brief.md](./brief.md) for the full context.

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

```sh
cd notebooks/
uv run --with marimo marimo edit --sandbox compare_models.py
```

Then open the link to the notebook in your browser and follow along

The models available are in `notebooks/util.py`. To add a model, update `MODEL_REGISTRY`.

## Decisions & Learnings Log

* Chose to use LiteLLM over anyLLM, for better telemetry (like token usage)
  and direct Langfuse integreation hooks. 
* OpenRouter for access to models, to reduce the number of API keys needed. 
* The first version used OpenCode Zen via the OpenAI SDK. (Retained for
  reference: `notebooks/archive_compare_models_with_zen.py`)

## Future Work

* system prompt as well as user prompt
* Update model registry to include frontier models, like Claude

## Results

See `brief.md` (draft, as experiment still in-progress). 

