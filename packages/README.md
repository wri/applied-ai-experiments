# Shared Packages

Reusable libraries that experiments build on. **Each package's own README is the
single source of truth for its API** — this page is the index: what exists, what's
inside, and where to read the details.

## Capability index

| Package | Scope | What's inside | Docs |
|---------|-------|---------------|------|
| `ui/` | `@wri-datalab/ui` | Svelte 5 component library + Prototype design tokens — layout, forms, BYOK widgets, LLM/chat display, data viewers, toasts | [README](./ui/README.md) · [Component reference](./ui/COMPONENTS.md) |
| `llm-lab/` | `@wri-datalab/llm-lab` | Browser-only LLM demo machinery: streaming `runLLM`/`fanOut`, JSON-Schema structured output + repair, cost/usage helpers, IndexedDB run history, request inspector, model registry (`./models`), the **session telemetry dashboard** (`SessionTelemetry`), and two keyless-visitor paths — **session replay** (`ReplayBanner`) and **per-request mocks** (`MockSpec` on `runLLM`) | [README](./llm-lab/README.md) |
| `byo-keys/` | `@byo-keys/*` | Bring-Your-Own-Key toolkit: provider abstraction + key storage, streaming chat, Svelte stores. Sub-packages: `core`, `providers`, `svelte` | [README](./byo-keys/README.md) · [Architecture](./byo-keys/ARCHITECTURE.md) |
| `shared-types/` | `@wri/shared-types` | Shared TypeScript type definitions | [README](./shared-types/README.md) |

For a typical LLM demo you'll use all three: `@wri-datalab/ui` for the interface,
`@byo-keys/svelte` for keys, and `@wri-datalab/llm-lab` for the call/cost/telemetry
layer. Scaffold from [`.github/templates/prototype-byok`](../.github/templates/prototype-byok)
(`just new-experiment <slug> prototype-byok`) as the reference wiring.

## Using packages

### TypeScript / Svelte

```json
// In the experiment demo's package.json
{
  "dependencies": {
    "@wri-datalab/ui": "workspace:*",
    "@wri-datalab/llm-lab": "workspace:*",
    "@byo-keys/svelte": "workspace:*"
  }
}
```

Internal packages are always `workspace:*` — never pin a version.

```svelte
<script>
  import { Button, Panel, ThemeSwitcher, ApiKeyManager } from '@wri-datalab/ui';
  import { SessionTelemetry } from '@wri-datalab/llm-lab';
  import '@wri-datalab/ui/styles';
</script>

<div data-variant="prototype">
  <ThemeSwitcher />
  <Panel title="Settings">
    <ApiKeyManager />
  </Panel>
  <Button variant="primary">Save</Button>

  <!-- Floating dev-view metrics for every LLM call this session -->
  <SessionTelemetry slug="my-experiment" />
</div>
```

## Keeping this current

These packages — including `@byo-keys/*` — are raw-source (consumers compile them via
Vite), so there is no build step, no committed `dist/`, and no generated API doc — the
READMEs are hand-maintained and easy to drift. The convention:

> **When you add or change a shared export, update that package's README in the same
> change.** If it's a new package, add a row to the capability index above. New
> `@wri-datalab/ui` components also go in [`ui/COMPONENTS.md`](./ui/COMPONENTS.md).

This is part of the experiment close-out checklist in `CONTRIBUTING.md`.

> **Note:** `CONTRIBUTING.md` is not tracked in git yet, so that path resolves in the
> working repo but not in a fresh clone.
