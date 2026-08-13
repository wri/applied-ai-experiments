# @wri-datalab/ui

A lightweight Svelte 5 component library and design system for minimally consistent demos.

## Quick Start

```svelte
<script>
  import { Button, Panel, Badge, Spinner } from '@wri-datalab/ui';
  import '@wri-datalab/ui/styles';
</script>

<div data-variant="prototype">
  <Panel title="Results">
    <Badge variant="success">Complete</Badge>
    <Button onclick={() => console.log('clicked')}>Run</Button>
  </Panel>
</div>
```

## Themes

Set `data-theme` on the `data-variant="prototype"` element:

| Attribute | Description |
|-----------|-------------|
| _(none)_ or `data-theme="dark"` | Dark theme (default) — warm browns/tans |
| `data-theme="light"` | Light theme — cool warm whites |
| `data-theme="high-contrast"` | High contrast — pure black/white with bright amber |

Use the `ThemeSwitcher` component for interactive switching (persists to localStorage).

## Components

**Full props for every component → [COMPONENTS.md](./COMPONENTS.md)** (includes bindable
markers, snippets, and gotchas). The list below is the inventory by category.

### Core UI
`Button` · `Card` · `Panel` · `Badge` · `Alert` · `Input` · `Select` · `Textarea` · `Toggle` · `Slider` · `Spinner` · `Skeleton` · `SearchInput` · `Tabs` · `Tooltip` · `Modal` · `CopyButton` · `EmptyState` · `StepIndicator` · `ThemeSwitcher`

### AI / LLM
`ChatMessage` · `StreamingText` · `StreamingMarkdown` · `TokenCounter` · `LatencyBadge` · `ThinkingSummary` · `CostDisplay` · `ComparisonTable`

### Data Display
`CodeBlock` · `Markdown` · `JsonViewer` · `DiffView`

### BYOK (Bring Your Own Keys)
`ApiKeyManager` · `ProviderSelector` · `ModelSelector`

### Layout
`DemoLayout` · `DemoHeader` · `DemoFooter` · `HeaderButton` (icon/text header control matching the theme/settings chrome; requires a sentence-case `label`) · `HeaderNav` (data-driven sub-view nav for the `headerNav` slot)

### Feedback
`Toast` · `ToastContainer` · `toast.success()` / `toast.error()` / `toast.info()` / `toast.warning()`

### User Settings
`UserSettings` · `UserSettingsTrigger` · `UserSettingsPopover`

## Utilities

```ts
import {
  formatTokens,    // 1500 → "1.5K"
  formatLatency,   // 250 → "250 ms"
  formatBytes,     // 1536 → "1.5 KB"
  formatPercent,   // 0.42 → "42%"
  formatRelativeTime,
  formatTimestamp,
  computeDiff,
  generateUnifiedDiff,
} from '@wri-datalab/ui';
```

## Design Tokens

The design system uses CSS custom properties organized in layers:

1. **Primitives** (`primitives.css`) — OKLCH color palette with 11 shades per family
2. **Theme** (`prototype.css`, `prototype-light.css`, `prototype-high-contrast.css`) — semantic tokens (`--bg`, `--tx`, `--primary`, `--ui`, etc.)
3. **Component** — per-component tokens (`--component-button-*`, `--component-input-*`, etc.)

Typography: IBM Plex Mono (UI/headings/code) + IBM Plex Sans (body). Two type scales — a
**compact UI scale** for chrome (labels, buttons, panel titles) and a larger **reading
scale** (`--text-prose-*`) for long-form content rendered by `Markdown` / `StreamingMarkdown`.
See `DESIGN.md` §3 (repo root; not tracked in git yet).

## Development

```bash
# Run the interactive component stories
pnpm --filter @wri-datalab/ui stories

# Type check
pnpm --filter @wri-datalab/ui check

# Run tests
pnpm --filter @wri-datalab/ui test
```

## Svelte 5

All components use Svelte 5 runes: `$props()`, `$state()`, `$derived()`, `$effect()`, `$bindable()`, and snippets. Peer dependency: `svelte ^5.0.0`.
