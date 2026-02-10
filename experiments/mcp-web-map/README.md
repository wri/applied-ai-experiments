# MCP Web Map

> Chat interface for MapLibre GL JS maps, built to test whether MCP running in a web worker is a viable architecture for browser-based LLM tool calling. See [brief.md](./brief.md) for the full context and findings.

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
# Open http://localhost:5173 and enter your API key
```

## What's in here

```
├── demo/src/
│   ├── routes/
│   │   ├── +layout.svelte        # BYOK context setup
│   │   └── +page.svelte          # Main map + chat UI
│   └── lib/
│       ├── components/            # UI components
│       ├── mcp/                   # MCP worker system
│       │   ├── types.ts           # Message protocol types
│       │   ├── worker.ts          # Web worker for tool execution
│       │   ├── bridge.ts          # Main thread bridge
│       │   └── tools/             # Tool implementations
│       ├── stores/                # Svelte state management
│       └── utils/                 # URL state encoding
├── brief.md
└── info.yaml
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `fly_to` | Animate to a location |
| `fit_bounds` | Fit view to bounding box |
| `get_view` | Get current map state |
| `list_layers` | List available layers |
| `set_visibility` | Toggle layer visibility |
| `show_popup` | Display a popup |
| `highlight` | Highlight features |
| `clear_highlight` | Remove highlights |
| `copy_link` | Copy shareable URL |

## Decisions & Learnings Log

- MCP running in a web worker keeps tool execution off the main thread, preventing UI jank during map operations.
- Running MCP client-side in a web worker functions well-enough, the message bridge between main thread and worker is straightforward to implement.
- Tool definition quality (names, descriptions, parameter schemas) heavily affects LLM accuracy in choosing and invoking the right tool.
- Streaming LLM responses significantly improves perceived responsiveness, even when total latency is unchanged.
- BYOK pattern lets users bring their own API keys without any server-side key management.

## Future Work (if resumed)

- Test performance with more complex map operations and tool calls.
- Evaluate model selection tradeoffs between cost and performance.

## Results

_Summary of findings once the experiment is complete. Link to [brief.md](./brief.md) for the full write-up._
