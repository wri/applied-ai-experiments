# {Experiment Title}

> See [brief.md](./brief.md) for context, signals, and findings.

This prototype is a **bring-your-own-key (BYOK)** SvelteKit demo: API keys live in
the visitor's browser and calls go straight to the provider, so the demo can be
deployed to GitHub Pages with no server and no shared secrets.

## Setup

### Prerequisites

- Node 22+ and [pnpm](https://pnpm.io/)
- An API key for at least one provider (Anthropic / OpenAI / Google), entered in the
  demo's settings at runtime — nothing is committed. Ollama works fully offline/local.

### Run it

```bash
pnpm install            # from the repo root (workspace install)
cd demo
LOCAL_DEV=true pnpm dev # serves at /<slug> with the dev base path
```

## What's wired for you

```
demo/src/
├── app.html                 # SEO block — synced from brief.md (see below)
├── lib/
│   ├── slug.ts              # SLUG derived from the base path (never hardcode it)
│   └── stores.ts            # BYOK client + all providers + key storage
└── routes/
    ├── +layout.svelte       # data-variant="prototype", ToastContainer, <SessionTelemetry/>
    └── +page.svelte         # prompt → streamed response, cost/token/latency, inspector
```

Out of the box you get model selection (`<ModelSelector>` fed by the shared model
registry), a streaming run loop (`createLLMRun`), a cost forecast, a request
inspector, and a telemetry dashboard (FAB, bottom-right) that reports per-call cost
**and estimated energy/carbon** — no extra wiring.

## First edits

1. **`brief.md`** — set the title (H1), the description (lede blockquote), and the frontmatter dates. Then run
   `uv run .github/scripts/sync-demo-meta.py <slug>` so `app.html` SEO matches.
2. **Model offering (optional)** — add a `DEMO_MODEL_SETS['<slug>']` entry in
   `packages/llm-lab/src/models/demos.ts` to curate which models/providers this demo
   shows. Without one it offers the full catalog (and logs a warning).
3. **`+page.svelte`** — replace the prompt UI and the single `run` slot with your
   experiment's actual interaction.
