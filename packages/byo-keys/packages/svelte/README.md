# @byo-keys/svelte

Svelte 5 / SvelteKit integration for the BYOK client — wraps `createBYOKClient` in
reactive stores and context helpers. This is what demos import, and what
`@wri-datalab/ui`'s BYOK components (`ApiKeyManager`, `ProviderSelector`, `ModelSelector`)
and `@wri-datalab/llm-lab`'s `runLLM` expect (`BYOKStores`).

**Main exports**
- `createBYOKStores(client)` → `BYOKStores` (reactive `keys`, `providers`, `models`,
  `selectedModels`, plus `chatStream(...)`).
- `setBYOKContext` / `getBYOKContext` — share stores via Svelte context.
- `createProviderReadyStore`, `createReadyProvidersStore` — readiness (has valid key).
- `initializeBYOK` — load stored keys on mount.
- Types: `BYOKStores`, `ChatStreamStore`.

SvelteKit wiring examples are in the top-level [byo-keys README](../../README.md). For the
canonical demo setup, copy [`experiments/structured-output-lab`](../../../../experiments/structured-output-lab).
