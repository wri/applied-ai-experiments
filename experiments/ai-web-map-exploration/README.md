# AI Web Map Exploration

> See [brief.md](./brief.md) for context, signals, and findings.

## Setup

### Prerequisites

- Node 20+, pnpm 10+ (run `pnpm install` at the repo root — this demo is part of the workspace).

### Install & Run

```bash
# from repo root
pnpm install

cd experiments/ai-web-map-exploration/demo
pnpm dev      # http://localhost:5173  (LOCAL_DEV=true)
pnpm check    # svelte-check, strict
pnpm build    # static build → demo/dist/
```

## What's in here

19 probes in three bands, each a folder under `demo/src/lib/demos/<slug>/` (`meta.ts` + `Demo.svelte`).

**UI patterns & context surfaces**

1. **Command palette** — ⌘K registered/parameterized commands, with an AI fallback that receives the full context snapshot.
2. **Context menu** — right-click menus assembled from what's under the cursor; chips show exactly what the model would see.
3. **Legend as surface** — the legend as interaction surface: toggle/emphasize/per-class "ask" + natural-language restyle via a validated legend spec.
4. **Context telemetry** — a live render of everything the app could feed a model, with per-section token costs.
5. **Dual brush** — one dataset in two spaces; brush an embedding scatterplot ↔ box-select the map.
6. **Style from structured output** — the LLM emits a constrained `StylePatch` (whitelisted ops/layers/props), schema-validated, repaired, applied with revert.

**Feature concepts**

7. **Ambient briefing** — what changed in saved regions since last visit; citations fly the camera.
8. **Query to viewport** — a sentence → camera + filters + style + legend; the URL captures the resolved state.
9. **Explain this view** — captures the map canvas + context → multimodal model; pointable evidence overlays.
10. **Map skills** — `skill.md`-style workflow files; a router picks one and executes a step plan on the map.
11. **Cloud-native query** — NL → guarded SELECT-only SQL → DuckDB-WASM in the browser against Overture's ~10 GB places GeoParquet on S3, with file-level + row-group pruning visualized.
12. **Anomaly walk** — "5 weirdest things in view"; z-scores in code, the model picks/explains, a guided flyover performs it.
13. **Portfolio copilot** — drop a messy site CSV; the model repairs flagged rows (per-row accept/reject), code screens against real water-risk sub-basins, answers cite basins.
14. **Ensemble explorer** — multi-model water-risk scoring UI: value-suppressing bivariate choropleth, strip plot, single-model cycling.
15. **Why this score?** — click a sub-basin; full weight arithmetic (incl. -9999 renormalization), provenance drawer, scale-of-use signal check.

**Agentic**

16. **Agent orchestrator** — map ↔ kanban over the same agent tasks; assets flow between views.
17. **The situation room** — one sentence → a planner (structured output) decomposes it into retrieval/analysis/cartography/critique; simulated agents drive real layers + an audit trail.
18. **Monitoring sentinel** — a plain-language watch → machine-checkable rule; a scrubbable flood-scenario clock, escalation ladder.
19. **Deep research** — a background agent runs guarded DuckDB-WASM SQL against S3 + local data, survives demo switches, and cites every finding.

```
demo/
├── src/
│   ├── app.css, app.html, app.d.ts
│   ├── routes/            +layout.{svelte,ts}, +page.svelte, [demo]/+page.svelte
│   └── lib/
│       ├── demos/         19 demo folders + shared/ + registry.ts
│       ├── map/           MapShell + Scene API (one persistent MapLibre map)
│       ├── llm/           BYOK/LLM adapter over @byo-keys + @wri-datalab/llm-lab (keeps keyless mock layer)
│       ├── context/       the shared context snapshot spine
│       ├── data/          DuckDB-WASM + Overture loaders
│       ├── style-patch/   validated restyle ops
│       ├── stores.ts,     @byo-keys client + stores
│       └── slug.ts
└── static/data/           committed runtime data (Overture places extract, water-risk basins, skills)
```

## References

- [Overture Maps Foundation](https://overturemaps.org/)
- [DuckDB-WASM](https://duckdb.org/docs/api/wasm/overview.html)
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)
