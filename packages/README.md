# Shared Packages

This directory contains shared libraries and utilities that can be used across experiments.

## Active Packages

| Package | Scope | Purpose |
|---------|-------|---------|
| `ui/` | `@wri-datalab/ui` | Svelte component library with Prototype design |
| `byo-keys/` | `@byo-keys/*` | BYOK pattern for LLM apps (monorepo) |
| `shared-types/` | `@wri/shared-types` | TypeScript type definitions |
<!-- | `eval-starter/` | Python | Evaluation toolkit (inspect_ai, promptfoo) | -->



## Using Packages

### TypeScript/Svelte

```json
// In experiment's package.json
{
  "dependencies": {
    "@wri-datalab/ui": "workspace:*",
    "@byo-keys/svelte": "workspace:*"
  }
}
```

```svelte
<script>
  import { Button, Panel, ThemeSwitcher, ApiKeyManager } from '@wri-datalab/ui';
  import '@wri-datalab/ui/styles';
</script>

<div data-variant="prototype">
  <ThemeSwitcher />
  <Panel title="Settings">
    <ApiKeyManager />
  </Panel>
  <Button variant="primary">Save</Button>
</div>
```
<!-- 
### Python

```toml
# In experiment's pyproject.toml
[tool.uv.sources]
eval-starter = { path = "../packages/eval-starter", editable = true }
```
-->