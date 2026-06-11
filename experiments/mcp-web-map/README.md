# MCP Web Map

> Chat-driven control of a MapLibre GL JS map, with **two interchangeable tool engines** you can toggle at runtime — a hand-rolled client-side bridge and the W3C **WebMCP** standard (`navigator.modelContext`) — to compare the build experience, limitations, and UX of each. See [brief.md](./brief.md) for the full context and findings.

## Setup

### Prerequisites

- Node.js 24+
- pnpm
- API key for at least one provider (Anthropic, Google, or OpenRouter)

### Install & Run

```bash
cd demo
pnpm install
pnpm dev
# Open the printed URL and enter your API key in the header
```

The chat uses [BYOK](../../packages/byo-keys) — keys live only in your browser's
localStorage. Use the **Engine** toggle in the header to switch between the
custom bridge and WebMCP; the engine that produced each reply is tagged in the
transcript.

## Two engines

The same chat drives the same tools through either engine. The only thing that
differs is how tools are registered and dispatched — the model-facing protocol
(a fenced ` ```tool ` JSON block) is identical, which keeps the comparison fair.

| | Custom bridge | WebMCP |
|---|---|---|
| Registration | Hand-rolled `ToolEntry` registry | `navigator.modelContext.registerTool()` |
| Dispatch | Direct call on the main thread | `getTools()` → `executeTool()` (W3C preview surface) |
| Prompt tool list | From static tool definitions | Enumerated from the registered tools |
| Input validation | Manual (required-param check) | Automatic, against the registered `inputSchema` |
| Runtime | None | [`@mcp-b/webmcp-polyfill`](https://www.npmjs.com/package/@mcp-b/webmcp-polyfill) |

WebMCP is the standard a browser-native agent (Chrome 149+/Edge 147) would
consume; here an in-page chat consumes it via the polyfill so the demo stays a
self-contained static site. See [brief.md](./brief.md) for the rough edges this
surfaced.

## What's in here

```
├── demo/src/
│   ├── routes/
│   │   ├── +layout.svelte        # BYOK context + theme
│   │   └── +page.svelte          # Map + chat UI, engine wiring
│   ├── static/data/
│   │   └── countries.geojson     # Bundled Natural Earth dataset (public domain)
│   └── lib/
│       ├── components/            # MapView, ChatPanel, EngineToggle, CommandPalette…
│       ├── agent/
│       │   └── loop.ts            # Engine-agnostic agentic loop (feeds tool results back)
│       ├── mcp/
│       │   ├── engine.ts          # ToolEngine interface + bridge & webmcp engines
│       │   ├── bridge.ts          # Custom-bridge dispatcher
│       │   ├── webmcp.ts          # WebMCP registration/dispatch via navigator.modelContext
│       │   ├── protocol.ts        # Shared tool-call parse/clean
│       │   ├── types.ts           # Tool definition types
│       │   └── tools/             # Tool implementations (navigation, layers, ui, data, geo)
│       └── stores/                # Map, chat, engine, URL state
├── brief.md
└── info.yaml
```

### Available tools

| Tool | Description |
|------|-------------|
| `fly_to` | Animate to a location |
| `fit_bounds` | Fit view to a bounding box |
| `get_view` | Get current map state |
| `list_layers` | List available layers |
| `set_visibility` | Toggle layer visibility |
| `get_layer_info` | Inspect a layer |
| `show_popup` / `close_popup` | Show / hide a popup |
| `highlight` / `clear_highlight` | Highlight features |
| `copy_link` | Copy a shareable URL |
| `search_place` | Geocode a place name (OpenStreetMap Nominatim) |
| `add_markers` / `clear_markers` | Drop / clear labeled markers |
| `add_data_layer` | Add a bundled or inline GeoJSON layer |
| `style_data_layer` | Choropleth a layer by a numeric property |
| `filter_data_layer` | Filter a layer by a property condition |
| `measure` | Distance along a path / area of a polygon (turf.js) |
| `query_at_point` | Identify the feature at a point (point-in-polygon / nearest) |

### Try these

Open the command palette (`Cmd/Ctrl + K`) for one-click prompts, or ask:

- "Find Nairobi and fly there"
- "Pin the 5 largest cities in Brazil and label each"
- "Add the countries layer and color it by population"
- "Measure the distance between Cairo and Cape Town"
- "Map the three largest cities in Kenya, then measure the distance between the two farthest apart and show a popup with the result"

Run each under both engines to compare.

## Decisions & Learnings Log

- **Standard vs custom** turned out to be the interesting axis, not worker vs
  main thread — the original web-worker framing was descoped.
- **WebMCP inverts ownership:** the page is a tool *provider*, with a
  browser-native agent as the intended consumer. Driving it from an in-page chat
  works but is off the happy path.
- **You get input-schema validation for free** with WebMCP; the custom bridge
  validates by hand.
- The strict `@mcp-b/webmcp-polyfill` exposes `registerTool` +
  `getTools()`/`executeTool()` but not `callTool()`/`listTools()`, so the engine
  carries a fallback chain. `registerTool` throws on duplicate names — guard
  registration at `navigator.modelContext`'s lifetime, not a module's.
- **Feeding tool results back** (the agentic loop) is what unlocks real
  multi-step requests.
- Tool definition quality and streaming responses both materially affect the UX,
  as before.

See [brief.md](./brief.md) for the full write-up.
