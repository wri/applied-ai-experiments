---
# ---- Required ----
title: "MCP Web Map"
type: prototype
status: done

# ---- Recommended ----
created_at: 2026-01-06
updated_at: 2026-06-24

# ---- Classification ----
targets: infra
themes:
  - prototyping
  - geospatial
tags:
  - webmcp
  - tool-calling

# ---- Demo ----
demo:
  enabled: true
  type: sveltekit
  build_command: "pnpm build"
  output_dir: "demo/dist"
---

# MCP Web Map

> Chat-driven control of a MapLibre GL JS map, with two interchangeable tool engines you can toggle between at runtime: a client-side bridge and the W3C WebMCP standard (navigator.modelContext) to compare the build experience, limitations, and UX of each.

## Before

### What problem or question does this address?

Can MCP run in the browser to connect an LLM to a basic map controls, and is chat-driven map interaction genuinely useful or just a novelty?

**Architectural:** can MCP run reliably in a browser web worker to bridge LLM tool-calling with client-side UI controls? Maps are a good test case: navigation, layer toggles, and annotations are all discrete, exposable tools.

**UX:** is natural language a better interface for common map tasks than direct manipulation?

For developers deciding whether the MCP-in-browser pattern is worth testing.

### What does this experiment actually do?

A SvelteKit prototype: a BYOK chat interface invokes MCP tools in a web worker to drive MapLibre GL JS.

- **Navigation** — `fly_to`, `fit_bounds`, `get_view`
- **Layers** — `list_layers`, `set_visibility`
- **Annotations** — `show_popup`, `highlight`, `clear_highlight`

### What signals are we looking for?

- **Architecture:** the browser MCP bridge executes tools without blocking the UI; the tool protocol is clean enough to reuse elsewhere; new tools can be added without modifying the bridge layer.
- **UX:** chat-driven map commands feel natural for common tasks, and there are task categories where chat is genuinely faster than clicking.

### What are the boundaries?

- **BYOK / browser-only** — no server-side keys or processing; everything runs client-side, keeping the pattern portable.
- **Scope:** chat-driven navigation, layer control, and state sharing.

---

## Learnings

- Some of the features that come across as the most impressive are just tools calling established APIs under the hood.  
- To make multi-step map requests work, we ended up feeding tool results back to models in a capped agentic loop, rather than using single-shot execution.
- Giving users a way to see the traces and tool calls helps generate trust and understanding around the responses. Transparency sates the curious and gives anyone a detailed surface to poke and prod at.

---

## After

**Outcome:** Confirmed: both a custom client-side tool dispatcher and the WebMCP standard can drive the same map + geospatial tools from an in-page LLM chat. WebMCP gets tool registration and automatic input-schema validation bundled in, but the standard is built for a browser-native agent to consume. Technically works but there are many other patterns that may be more practical.  

### Signal check

- **Protocol clean enough to reuse** — **Confirmed.** The fenced tool-call protocol and shared tool registry works consistently in tests with fast, cheap models. 19 tools at the time of writing, not cardinally up there but good enough for this surface test.
- **Chat feels natural / faster than clicking** — **Inconclusive.** Multi-step requests are where chat feels faster or more capable ("map the 3 largest cities in Kenya, then measure the distance between the two farthest apart"). Most basic navigation actions are faster by hand. Overall feeling is map navigation with a mouse is more fun and intuitive, chat feels more useful when it's operating on another axis and doing things other than trying to reinvent mature web map UX and nav controls.

### What happened?

Started with just the basic navigation items, but then grew the tool surface from 8 to 19 tools: Adding Nominatim geocoding, markers, data layers over a bundled Natural Earth countries file (choropleth styling, filtering), and turf.js spatial analysis.

### What would you recommend?

- For a self-contained prototype today, a small custom dispatcher seem like a more pragmatic choice.
- WebMCP might someday be a better choice when the consumer is an external or browser-native agent. Then you get the registration, schema validation, and a standard discovery surface.

### What decisions and tradeoffs came up along the way?

- Added WebMCP part way through (it was new). Shifted to an approach with one shared tool registry.
- A fenced-JSON tool protocol instead of native provider tool-calling kept the things comparable across providers, but could elevate risk of parsing failures.
- The agent loop needs a hard turn cap (we set it to 6) to avoid runaways when a model keeps calling tools.
