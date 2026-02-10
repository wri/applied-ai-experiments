# MCP Web Map

> MCP can feasibly run in the browser. This experiment tests using a web worker to connect LLMs to MapLibre GL JS map controls via MCP tool calling, and evaluates whether chat-driven map interaction is genuinely useful or just a novelty.

## Before

### What problem or question does this address?

The primary question is architectural: **can MCP run reliably in a browser web worker to bridge LLM tool-calling with client-side UI controls?** MCP can run in the browser, this experiment aims to test patterns for wiring up a reusable approach.

The secondary question is about UX: is natural language a better interface for common map tasks than direct manipulation? Maps are a good test case because they have a rich set of controls (navigation, layer toggles, annotations) that can be exposed as discrete tools. When does latency become a problem?

This is primarily aimed at developers evaluating whether the MCP-in-browser pattern is worth adopting, not at end users directly.

### What does this experiment actually do?

A SvelteKit prototype that tests the MCP-in-web-worker pattern using MapLibre GL JS as the control surface. A chat interface powered by LLMs (Anthropic, Google, or OpenRouter via BYOK) invokes MCP tools running in a web worker to control the map:

- **Navigation:** `fly_to`, `fit_bounds`, `get_view` — move the map via natural language ("Fly to New York City")
- **Layers:** `list_layers`, `set_visibility` — toggle and query layers ("Show me the satellite layer")
- **Annotations:** `show_popup`, `highlight`, `clear_highlight` — mark features on the map

### What signals are we looking for?

**Primary — Architecture:**
- Does the MCP web worker bridge execute tools without blocking the UI?
- Is the message protocol between main thread and worker clean enough to reuse in other projects?
- Can new tools be added without modifying the bridge layer?

**Secondary — UX:**
- Do chat-driven map commands feel natural for common tasks (navigation, layer toggling)?
- Are there any task categories where chat is genuinely faster than clicking?

**Failure looks like:**
- The web worker bridge adds too much complexity relative to just calling tools on the main thread
- Tool definition quality (names, schemas) isn't sufficient for LLMs to reliably choose the right tool
- Chat-driven map control is consistently slower and more awkward than direct manipulation

### What are the boundaries?

- **Scope:** Chat-driven map navigation, layer control, and state sharing with BYOK API keys
- **BYOK-only:** Deliberately no server-side key management, users provide their own API keys, keeping the prototype self-contained
- **Browser-only:** Everything runs client-side, which limits tool capabilities but keeps the pattern portable and easy to replicate
- **Not doing:** Spatial analysis, data querying, custom layer creation, server-side processing
- **Dependencies:** MapLibre GL JS, at least one LLM API key (Anthropic, Google, or OpenRouter)

---

## After

_Fill this section out when the experiment concludes or is stopped._

### What happened?

### What did you learn?

### What would you recommend?

### What decisions and tradeoffs came up along the way?
