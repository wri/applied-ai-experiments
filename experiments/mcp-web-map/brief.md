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

_Updated 2026-06-09 when the experiment was resumed and expanded._

### What happened?

The experiment was resumed with two changes of direction:

1. **The "MCP in a web worker" question was descoped.** Tools always ran on the
   main thread; the worker never added enough value to justify the complexity,
   and the more interesting question turned out to be *how* tools are registered
   and dispatched, not *which thread* they run on.

2. **A second tool engine was added and made toggleable at runtime**, so the
   same chat can drive the same tools through either:
   - **Custom bridge** — the original hand-rolled registry + dispatcher, and
   - **WebMCP** — the W3C `navigator.modelContext` standard, via the
     [`@mcp-b/webmcp-polyfill`](https://www.npmjs.com/package/@mcp-b/webmcp-polyfill).

   Both engines keep the *identical* model-facing protocol (a fenced
   ` ```tool ` JSON block), so the only variable is registration + dispatch.

The tool surface was also expanded well beyond the original navigation/layer
set, deliberately crossing the old "not doing" boundary (spatial analysis, data
querying, layer creation):

- **Geocoding** (`search_place`, via OpenStreetMap Nominatim) — resolve a place
  name to coordinates so the model chains to `fly_to`/`fit_bounds` instead of
  hallucinating coordinates.
- **Markers** (`add_markers`, `clear_markers`) — the model generates structured
  geodata and drops labeled pins.
- **Data layers** (`add_data_layer`, `style_data_layer`, `filter_data_layer`)
  over a bundled Natural Earth countries dataset — add a GeoJSON layer, color it
  as a choropleth by a numeric property, and filter it.
- **Spatial analysis** (`measure` via turf.js, `query_at_point` point-in-polygon).

Finally, the chat was upgraded from single-shot tool execution to a proper
**agentic loop**: tool results are fed back to the model so multi-step requests
("map the 3 largest cities in Kenya, then measure the distance between the two
farthest apart") actually chain.

### What did you learn?

- **WebMCP inverts ownership.** The standard is designed for the *browser /
  native agent* to be the consumer; the page is a tool *provider*. Driving it
  from your own in-page BYOK chat is off the happy path — it works, but you are
  using the page-producer side of an API meant to be read by something else.
- **You get input validation for free.** The polyfill validates tool arguments
  against the registered `inputSchema` (a missing required field is rejected
  *before* `execute` runs). The custom bridge has to do this by hand in
  `invokeTool`.
- **The strict polyfill is genuinely strict.** `@mcp-b/webmcp-polyfill@3` exposes
  `registerTool` + the producer-preview `getTools()`/`executeTool()`, but **not**
  the MCP-B `callTool()`/`listTools()` extensions (those live in `@mcp-b/global`).
  A robust engine needs a fallback chain: `callTool` → `getTools`+`executeTool`
  → direct invocation.
- **No synchronous page-side enumeration.** `getTools()` is async, so building a
  system prompt *from the registered tools* forces an async prompt path (or a
  static fallback). And `registerTool` throws on duplicate names, so
  registration has to be guarded at a lifetime that matches
  `navigator.modelContext` (a window-scoped flag), not a module-local one — this
  bites immediately under HMR.
- **The custom bridge is more code but fewer seams.** Everything is synchronous,
  in one place, and fully under your control. WebMCP is less code to *register*
  but adds a standards/runtime layer whose shape (extensions vs strict core,
  preview APIs, deprecations like `provideContext`) is still moving.
- **Per the Chrome docs**, native consumption is gated behind
  `chrome://flags/#enable-webmcp-testing` (Chrome 149+) / an origin trial and a
  security model (HTTPS-only, `Origin-Agent-Cluster`, a Permissions-Policy
  `tools` directive, no headless). The polyfill is what keeps this demo a
  self-contained static site.

### What would you recommend?

- For a **self-contained prototype today**, a small custom dispatcher is the
  pragmatic choice — no extra runtime, no moving spec, full control.
- **Adopt WebMCP when the consumer is an external/native agent** (the case it is
  designed for): exposing your app's actions to Claude-in-Chrome, Edge, or a
  future browser agent. Then registration + schema validation + a standard
  discovery surface are exactly what you want, and you are no longer fighting the
  ownership inversion.
- Whatever the engine, **keep the model-facing tool protocol independent of it**
  and **feed tool results back** — both were the changes that mattered most for
  real multi-step tasks.

### What decisions and tradeoffs came up along the way?

- **One shared tool registry, two engines.** Tool *logic* lives once in
  `mcp/tools/*`; the engines differ only in registration/dispatch. This is what
  makes the A/B honest, and it kept the new tools working in both with no extra
  effort.
- **Polyfill over native.** Native `navigator.modelContext` is flag/origin-trial
  gated, so the deployed demo uses the polyfill; the native path is noted as a
  one-off check, not the shipping path.
- **Bundled dataset over live API.** A trimmed (~200 KB) public-domain Natural
  Earth countries file makes the data tools work fully offline and on-brand;
  only geocoding hits a live service (Nominatim, which rate-limits and can't set
  a `User-Agent` from the browser).
- **Turn cap on the agent loop.** Multi-turn tool feedback needs a ceiling
  (6 turns) to avoid runaway loops when a model keeps calling tools.
