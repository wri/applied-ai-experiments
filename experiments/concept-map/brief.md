---
# ---- Required ----
title: "Concept Map Generator"
type: prototype
status: done

# ---- Recommended ----
created_at: 2026-06-10
updated_at: 2026-07-15

# ---- Classification ----
targets: feature
themes:
  - prototyping
  - patterns
tags:
  - knowledge-graph
  - visualization

# ---- Demo ----
demo:
  enabled: true
  type: sveltekit
  build_command: "pnpm build"
  output_dir: "demo/dist"
---

# Concept Map Generator

> Turn any topic into an interactive concept map. The LLM generates structured graph data as nodes and edges JSON, and a deterministic d3-force renderer lays it out. Click a node to explore the detail, and expand nodes iteratively.

## Before

### What problem or question does this address?

The quintessential human-AI interaction is a person facing down a wall of text.

If you treat the LLM as a graph generator instead, you can ask it to generate nodes and edges JSON validated against a schema, rendered by deterministic code. Every node is then clickable, and you get to explore branching topics by clicking on them.

Primary theme: **prototyping**. It informs two questions. Is "the LLM emits structured data, deterministic code renders it" an approach worth reaching for when the output is visual? And is a generated concept map a portal to an interesting analysis surface, or more of a visual gimmick?

### What does this experiment actually do?

A browser-only SvelteKit demo (BYOK).

1. The user gives a topic and picks one of five map styles: explainer, stakeholder, causal, evidence, or project.
2. The LLM returns nodes and edges JSON against a fixed graph schema, with one repair pass on a validation failure. Dangling edges are dropped.
3. A d3-force layout positions the graph, and a Svelte SVG renderer draws it, with pan, zoom, hover, and click.

Clicking a node opens a panel with its description, its connections, and follow-up questions. "Expand this node" asks for 3–6 new related nodes and merges them into the existing graph. The map exports to SVG, PNG, and JSON.

### What signals are we looking for?

- **Success** — Maps are coherent enough for a reader to follow and learn from.
- **Failure** — Dense, unreadable graphs with poor layout. Or constant dangling-edge violations, which would show that the model cannot hold referential integrity.

### What are the boundaries?

- **Interaction** — Pan, zoom, and click only. No drag-to-rearrange.
- **Division of labor** — The LLM only ever produces graph data. Layout and rendering stay deterministic and client-side.

---

## Learnings

- AI is very good at writing D3 code, but that doesn't mean it will create a responsive and adaptable system where the layout will easily handle unpredicted shapes or content. The system boundaries are still tricky to handle.
- There are a lot of non-chat forms that AI-powered features can take, the options are almost endless.

---

## After

**Outcome:** Confirmed (architecture, not map quality): letting the model emit only schema-validated graph data, while deterministic code owns layout and rendering, is a straightforward approach for generated visuals.

### Signal check

- Maps are coherent enough for a reader to follow and learn from.
- Expansion reuses node ids rather than duplicating concepts.

### What happened?

The LLM returns nodes and edges against a fixed graph schema with one repair pass. Each of the five styles supplies its own node-type vocabulary through the system prompt.

### What would you recommend?

- Demonstrates a concept well enough, good to conclude here.

### What decisions and tradeoffs came up along the way?

- Added five style vocabularies rather than one generic prompt to show more flavor.
- Dangling edges dropped rather than repaired, was cheaper, and only seemed to be a problem in a couple early tests.
