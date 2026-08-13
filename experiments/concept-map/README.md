# Concept Map Generator

> See [brief.md](./brief.md) for context, signals, and findings.

Part of the LLM-lab demo series (see also `ask-ten-times`, `structured-output-lab`, `mcp-web-map`), which share `@wri-datalab/llm-lab` for run history (IndexedDB), request inspection, JSON Schema validation, cost tracking, and exports.

## Run locally

```sh
pnpm install            # from repo root
cd experiments/concept-map/demo
pnpm dev
```

**No API key needed to try it.** With no key configured the demo runs keylessly from committed
fixtures in `demo/src/lib/mocks.ts`, and a banner says so. For live calls, bring your own key
(Anthropic, OpenAI, or Gemini) via the settings menu — keys live in your browser's localStorage
and calls go straight to the provider.

### Keyless mode

Both fixtures resolve to a string that travels the demo's normal path —
`parseStructured(GRAPH_SCHEMA)` and then `enforceIntegrity()` — so a fixture that would fail the
schema, or that references a node id that doesn't exist, fails keylessly exactly as it would
live. Nothing is spent, so the run meta reads "no spend (mock)" rather than a cost.

- **Generate** is a `match` fixture: the default topic has a full hand-written ten-node map;
  any other topic gets a small placeholder map that says as much rather than pretending.
- **Expand is computed, not canned.** A recorded fixture could only ever expand the one node it
  was written for. Instead the expand fixture is a `fn` spec that reads the focal node's record
  back out of the prompt and synthesises three children that connect to *it*, reusing the focal
  node's type so the additions stay inside the active map style's vocabulary and salting ids
  against collisions. That makes **every node on any map expandable with no key** — the thing a
  fixed recording can't do.

See `packages/llm-lab/README.md` §"Per-request mocks" for the mechanism, and update
`mocks.ts` whenever `GRAPH_SCHEMA`, the map styles, or the default topic change.

## The architecture, which is the point

**The model only ever emits data. It never sees a pixel, a coordinate, or a colour.** Layout and
rendering are deterministic code. Everything about a generated visual that can break in a
hard-to-debug way — overlap, positioning, legibility, theme — is therefore code you fix once and
test, while the model handles only the part that genuinely needs judgement.

Three layers, each catching strictly less than you'd hope, which is why there are three:

| Layer | Catches | Misses |
|---|---|---|
| `GRAPH_SCHEMA` + one repair pass | Malformed output, missing fields | Edges pointing at nodes that don't exist |
| `enforceIntegrity()` | Dangling edges — dropped, **with the count shown in a toast** | The same concept appearing twice under different ids |
| (not built) | — | Concept-level duplication — see the brief's recommendations |

Layout warm-starts from previous positions on expansion, seeds new nodes near the focal node,
and uses a lower alpha so the existing map stays put. That isn't polish: correct new content in
a rearranged map is worse than useless, because the user loses the spatial memory they were
navigating by.

## What's inside

- `demo/src/lib/graph/types.ts` — graph data types + the JSON Schema every map must conform to
- `demo/src/lib/graph/layout.ts` — synchronous d3-force layout, fixed 200 ticks (the deterministic renderer half)
- `demo/src/lib/prompts/map-styles.ts` — five map styles (explainer, stakeholder, causal, evidence, project), each a system prompt supplying its own node-type vocabulary over the shared schema
- `demo/src/lib/prompts/expand.ts` — grow-the-graph prompt for "Expand this node"
- `demo/src/lib/state/map.svelte.ts` — generate/expand state machine with repair pass, referential-integrity check, and merge/dedupe (Svelte 5 runes)
- `demo/src/lib/mocks.ts` — keyless fixtures; the expand one is computed, not canned (see above)
- `demo/src/lib/components/` — GraphCanvas (SVG pan/zoom renderer), NodePanel

## References

- [d3-force](https://d3js.org/d3-force)
