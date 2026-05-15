# Comparing LLM Models for WRI Tasks
Interactive tool for querying multiple LLMs with the same prompt in parallel and comparing their responses, latency, token counts, and cost. See [brief.md](./brief.md) for the full context.


## Status

This experiment is currently in progress.
* A few test queries have been tried, but would like to utilize tasks that are specific to WRI. 
    * these tasks to be identified
* Goal is to demo (to the applied AI community?) for iteration at least once before closing out the experiment.

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

## Decisions & Learnings Log

* Went with LiteLLM over anyLLM, for better telemetry (like token usage) and direct Langfuse integration hooks. 
* Used OpenRouter for access to models, to reduce the number of API keys needed. 
    * First tried OpenCode Zen via the OpenAI SDK (retained for reference: `notebooks/archive_compare_models_with_zen.py`)

## Future Work

* Examine System Prompt vs. User Prompt
* Update model registry to include frontier models, like Claude

## Results

See `brief.md` (draft, as experiment still in-progress). 

