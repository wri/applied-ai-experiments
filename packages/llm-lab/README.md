# @wri-datalab/llm-lab

Shared machinery for browser-only LLM demo experiments (BYOK pattern). Everything runs client-side; nothing touches a server.

## What's inside

| Module | Use |
|---|---|
| `runLLM` / `createLLMRun` / `fanOut` | Streaming call wrapper (content, usage, latency, inspectable request) + concurrency-limited fan-out with cooperative abort |
| `parseStructured` / `validateJsonSchema` / `buildRepairPrompt` | Extract JSON from LLM text, validate against user-editable JSON Schema (`@cfworker/json-schema` — light, no eval), human-readable error traces, repair-loop prompt builder |
| `createRunHistory` / `HistoryPanel` | IndexedDB-backed local run history (one shared `wri-llm-lab` DB, scoped per experiment slug) |
| `RequestInspector` | Panel/modal showing the exact messages, params, schema, and raw responses for any call |
| `estimateCost` / `computeCost` / `sumUsage` | Pre-run forecasts (chars/4 heuristic) and actuals from provider usage metadata |
| `downloadJson/Csv/Markdown`, `downloadSvg/Png`, `encodeShareConfig` | Export layer; share-config strips anything credential-shaped |

## Notes

- **Cancellation is cooperative**: byo-keys streams don't accept an AbortSignal, so abort stops consuming the stream (which closes the reader). Good enough for demos.
- `createLLMRun` lives in a `.svelte.ts` file (runes); everything else is framework-free TypeScript.
- Raw-src package like `@wri-datalab/ui` — consumers compile it via vite-plugin-svelte.

```sh
pnpm --filter @wri-datalab/llm-lab test
pnpm --filter @wri-datalab/llm-lab check
```
