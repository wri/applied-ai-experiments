---
# ---- Required ----
title: "AI Web Map Exploration"
type: prototype
status: done

# ---- Recommended ----
created_at: 2026-07-06
updated_at: 2026-07-31

# ---- Classification ----
targets: feature
themes:
  - prototyping
  - geospatial
tags:
  - maplibre
  - duckdb-wasm

# ---- Demo ----
demo:
  enabled: true
  type: sveltekit
  build_command: "pnpm build"
  output_dir: "demo/dist"
---

# AI Web Map Exploration

> A single web-map app that bundles several self-contained designprobes for AI-powered features in a map UI — command palettes and context surfaces, structured-output cartography, in-browser cloud-native querying, and simulated agents.

## Before

### What problem or question does this address?

What do AI-powered features actually feel like inside a web map, and which patterns are worth reusing? A design sprint buildng a basic SvelteKit scaffold and a persistent MapLibre map, working through some AI-adjacent map interaction concepts.

Web maps are dense, spatial and multi-layer experiences with a well-established design language, with access to rich context and the UX flexibility of an infinite canvas; and yet many of the AI-powered web map features we've seen in the wild tend to feel like chatbots slapped onto a map. This is an exploratory design probe intended to demonstrate a few ideas, and to hash out a scaffold we can use to field future map-focused requests.

This exploration is breadth-first: sketch many probes across three bands (UI patterns and context surfaces, feature concepts, agentic patterns) to find which interaction designs, context-engineering approaches, and structured-output loops are genuinely useful.

### What does this experiment actually do?

A static SvelteKit app with a left-panel demo switcher over one persistent MapLibre map. LLM access is BYOK, but every request carries a deterministic mock fixture so the full UX runs keyless. Probes span:

- **UI patterns / context surfaces** — command palette, context menu, legend-as-surface, context telemetry, dual-brush (embeddings ↔ map), style-from-structured-output.
- **Feature concepts** — ambient briefing, query-to-viewport, explain-this-view (multimodal), map skills, cloud-native query (DuckDB-WASM over Overture on S3), anomaly walk, portfolio copilot, ensemble explorer, why-this-score.
- **Agentic** — agent orchestrator (map ↔ kanban), the situation room (planner → simulated agents), monitoring sentinel, deep research.

### What signals are we looking for?

- Which interaction patterns feel natural and worth reusing, and which are novelty?
- Does keyless-first (mock fixtures validated by the same schema path as live) make a multi-demo AI app explorable without eroding fidelity?
- Can structured output be constrained enough (real vocab, whitelisted ops, repair loop) to drive cartography and NL→SQL and what are the common failure modes?
- Is browser-side cloud-native geospatial query (DuckDB-WASM against S3 GeoParquet) practical and are there simple rules that can be applied to avoid expensive calls?

### What are the boundaries?

- **BYOK / browser-only** — no server-side keys.
- **Breadth over depth** — probes are proofs of concept.
- **Two provenances kept explicit** — Opting for real data sources (Overture, water-risk baselines) over modeled overlays where practical, with labels.

---

## Learnings

- Keyless-by-default via a required per-request mock spec plus a BYOK option makes sharing live experiential demos a free/viable option.
- Running mock fixtures through the same extract/validate/repair path as live output keeps mock responses on their toes.
- Structured-output for client-side cartography needs a knowable schema, enumerated vocabulary (whitelisted ops/layers/props, attribute inventory, basin ids, etc.); the model then can't invent layers, columns, or features.
- For web mapping applications, a shared context snapshot ('what does the app know right now') is a promising metadata surface with lots of interesting directions for further exploration.
- DuckDB-WASM can query ~10 GB of Overture GeoParquet on S3 from the browser if you prune aggressively: file-level spatial extents indexed at extract time plus parquet row-group pruning, with the scan cost shown to the user help to muddle through some early rough patches. Some context challenges can be solved with classic web mapping design patterns, like constraining layer visibility to specified zoom levels.
- There is a lot of ambient context available to AI features in a web map, from layer metadata to viewport state. The challenge is picking the right bits and surfacing them to the model effectively — a design problem that is highly context-dependent.
- Many of the most interesting UX explorations involved interactions happening outside the chat interface. Using the product surface as the canvas, rather than an anything-goes chat window, encourages more exploration of the interplay between data interaction and UI components.

---

## After

**Outcome:** Confirmed: several AI-in-a-map design probes over one persistent map found a couple of patterns that generalize well — a per-request mock fixture plus optional BYOK calls makes keyless demos a reasonable option, and constraining the model to real, enumerated vocabulary plus a repair loop makes structured-output cartography and NL→SQL a promising direction.

### Signal check

- **Which patterns are worth reusing, and which are novelty?** — **Confirmed.** Hard to judge overall, but feedback suggests mostly positive, with several demo patterns getting picked up and adapted into product builds.
- **Can structured output be constrained enough for cartography and NL→SQL?** — **Confirmed.** Constraining the schema to real, enumerated vocabulary (whitelisted ops/layers/props, real attribute inventory, real feature ids) plus a quick repair loop means the model can't invent layers, columns, or features. Still need to see if the pattern blows up when the system has to handle many more datasets and complex interaction patterns.
- **Is browser-side cloud-native query practical?** — **Confirmed.** Even large source files are viable when you prune aggressively, and ambient map context provides many opportunities to minimize file scan costs. Still some lifecycle and debounce issues to work out, but the pattern is nice.

### What happened?

Shipped more than a dozen working probes over one persistent map and one shared context scaffold.

### What would you recommend?

- There are still so many underexplored opportunities for AI-powered map interaction. A breadth-first design exploration is fun and all, but starting from a real problem statement first would probably yield more useful results for any given problem space.

### What decisions and tradeoffs came up along the way?

- Breadth capped by shared infrastructure. Investing early in one map shell, one LLM layer, and one context snapshot is what made more than a dozen design probes affordable.
- Avoided approaches that would have required backend infrastructure, like agentic workflows requiring compute execution sandboxes, and avoided more complex patterns that might've been useful to gauge capability gaps between available models.
