# `@wri-datalab/ui` — Component reference

Props for every exported component, derived from source. Use this to avoid reading each
`.svelte` file. The [README](./README.md) covers setup, themes, and design tokens.

**Legend** — `prop` = required · `prop?` = optional · **✎ `prop`** = `$bindable` (use
`bind:prop`) · _Snippets_ = snippet props (`{#snippet}` / child content). Every component
also accepts `class?`. Components marked _+HTMLxAttributes_ forward standard DOM
attributes (`onclick`, `disabled`, `id`, …).

> Quick gotchas: **`Badge` has no `size`** · **`Slider`/`Toggle`/`Input`/`Select`/
> `Textarea`/`Tabs`/`Panel`/`Modal` use `bind:`** (don't use event handlers to drive
> their value) · **`CostDisplay` recomputes** cost from its `pricing` prop (defaults to
> Sonnet) — pass exact pricing or render the figure yourself.

## Core UI

| Component | Props | Snippets |
|-----------|-------|----------|
| `Button` | `variant?` `'primary'\|'secondary'\|'ghost'\|'danger'` · `size?` `'sm'\|'md'\|'lg'` · `loading?` · _+HTMLButtonAttributes_ | `children` |
| `Card` | `padding?` `'sm'\|'md'\|'lg'` · _+HTMLAttributes_ | `children` |
| `Panel` | `title?` · `collapsible?` · **✎ `collapsed?`** · _+HTMLAttributes_ | `children`, `actions` |
| `Badge` | `variant?` `'default'\|'success'\|'warning'\|'error'\|'info'` · _+HTMLAttributes_ (**no `size`**) | `children` |
| `Alert` | `variant?` `'default'\|'info'\|'success'\|'warning'\|'error'` · `dismissible?` · `ondismiss?` | `children`, `title` |
| `Input` | **✎ `value?`** `string` · `label?` · `error?` · `hint?` · _+HTMLInputAttributes_ | — |
| `Textarea` | **✎ `value?`** `string` · `label?` · `error?` · `hint?` · `resize?` · `minRows?` · `maxRows?` · _+HTMLTextareaAttributes_ | — |
| `Select` | **✎ `value?`** `string` · `options` `Option[]` · `label?` · `error?` · `hint?` · `placeholder?` · `disabled?` · `id?` · `onchange?(value)` | — |
| `Toggle` | **✎ `checked?`** · `label?` · `labelPosition?` `'left'\|'right'` · `size?` `'sm'\|'md'\|'lg'` · `disabled?` · `id?` | — |
| `Slider` | **✎ `value?`** `number` · `min?` · `max?` · `step?` · `label?` · `presets?` `Preset[]` · `formatValue?(v)` · `showValue?` · `disabled?` · `id?` | — |
| `SearchInput` | **✎ `value?`** · `placeholder?` · `disabled?` · `size?` `'sm'\|'md'\|'lg'` · `onchange?(v)` · `oninput?(v)` · `onclear?` | — |
| `Tabs` | `items` `TabItem[]` · **✎ `active?`** `string` · `size?` `'sm'\|'md'\|'lg'` · `onchange?(id)` | — |
| `Tooltip` | `text?` `string` · `position?` `'top'\|'bottom'\|'left'\|'right'` · `delay?` `number` (shows on hover + focus) | `children` (trigger), `tip` (rich content) |
| `Modal` | **✎ `open?`** · `title?` · `size?` `'sm'\|'md'\|'lg'\|'full'` · `closeOnBackdrop?` · `closeOnEscape?` · `showCloseButton?` · `onclose?` | `children`, `footer` |
| `CopyButton` | `text` `string` · `variant?` `'primary'\|'secondary'\|'ghost'` · `size?` · `label?` · `successLabel?` · `feedbackDuration?` · `iconOnly?` | — |
| `Spinner` | `size?` `'sm'\|'md'\|'lg'` | — |
| `Skeleton` | `variant?` `'text'\|'circular'\|'rectangular'` · `width?` · `height?` · `lines?` · `animate?` | — |
| `EmptyState` | `title` `string` · `description?` · `icon?` | `children` |
| `StepIndicator` | `steps` `string[]` · `current` `number` | — |
| `ThemeSwitcher` | `target?` `string` (selector to theme; defaults to nearest `[data-variant]`) | — |

## AI / LLM

| Component | Props | Snippets |
|-----------|-------|----------|
| `ChatMessage` | `role` `'user'\|'assistant'\|'system'` · `content` `string` · `timestamp?` · `model?` · `tokens?` `{input?,output?}` · `latency?` · `status?` `'streaming'\|'complete'\|'error'` · `thinking?` · `thinkingStreaming?` · `thinkingCollapsed?` | — |
| `StreamingText` | `text` `string` · `speed?` · `delay?` · `paused?` · `cursor?` · `onComplete?` | — |
| `StreamingMarkdown` | `content` `string` · `streaming?` · `cursor?` · `onComplete?` | — |
| `TokenCounter` | `tokens` `{input?,output?,total?} \| number` · `limit?` · `showBreakdown?` · `variant?` `'inline'\|'detailed'` · `size?` `'sm'\|'md'` | — |
| `LatencyBadge` | `ms` `number` · `thresholds?` `{good,fair}` · `showUnit?` · `size?` `'sm'\|'md'` | — |
| `ThinkingSummary` | `content` `string` · `streaming?` · **✎ `collapsed?`** · `showCharCount?` · `label?` | — |
| `CostDisplay` | `tokens` `TokenCounts \| number` · `pricing?` `PricingTier` · `currency?` · `showBreakdown?` · `variant?` `'inline'\|'detailed'` · `size?` (**recomputes from `pricing`; defaults to Sonnet**) | — |
| `ComparisonTable` | `columns` `Column[]` · `rows` `Row[]` · `title?` | — |

## Data display

| Component | Props | Snippets |
|-----------|-------|----------|
| `CodeBlock` | `code` `string` · `language?` · `showLineNumbers?` · `highlightLines?` `number[]` · `maxHeight?` · `copyable?` · `filename?` | — |
| `Markdown` | `content` `string` · `sanitize?` · `measure?` (cap line length to ~68ch for reading) | — |
| `JsonViewer` | `data` `unknown` · `initialExpandDepth?` · `copyable?` · `maxStringLength?` | — |
| `DiffView` | `oldText` `string` · `newText` `string` · `oldLabel?` · `newLabel?` · `mode?` `'unified'\|'split'` · `showLineNumbers?` | — |

## BYOK (Bring Your Own Keys)

All take a `stores: BYOKStores` (from `@byo-keys/svelte`). Model lists/config come from
`@wri-datalab/llm-lab/models` (`modelSelectorConfigForDemo`).

| Component | Props | Snippets |
|-----------|-------|----------|
| `ApiKeyManager` | `stores` · `providers?` `ProviderId[]` · `showAll?` | — |
| `ProviderSelector` | **✎ `value?`** `ProviderId` · `stores` · `onlyReady?` · `label?` · `placeholder?` · `onchange?(id)` | — |
| `ModelSelector` | `stores` · `config?` `ModelSelectorConfig` · **✎ `providerId?`** · **✎ `modelId?`** · `onselect?(providerId,modelId)` · `compact?` | — |

## Layout

| Component | Props | Snippets |
|-----------|-------|----------|
| `DemoLayout` | `title` `string` · `description?` · `subtitle?` · `stores?` · `providers?` · `showSettings?` · `showTheme?` · `showApiKeys?` · `showFooter?` · `maxWidth?` `'sm'\|'md'\|'lg'\|'xl'\|'full'` | `children`, `headerActions`, `headerNav`, `footer` |
| `DemoHeader` | `title` `string` · `subtitle?` · `stores?` · `providers?` · `showSettings?` · `showTheme?` · `showApiKeys?` · `maxWidth?` | `actions`, `nav` (DemoLayout exposes these as `headerActions`/`headerNav`) |
| `DemoFooter` | `maxWidth?` | `children` |
| `HeaderButton` | `variant?` `'icon'\|'text'` · `label` `string` (sentence case; becomes `aria-label`+`title`) · `active?` · _+HTMLButtonAttributes_ | `children` (icon SVG or text) |
| `HeaderNav` | `items` `HeaderNavItem[]` (`{id, label, href?, onclick?}`) · `active?` `string` · `ariaLabel?` | — |

## Feedback

| Component | Props | Snippets |
|-----------|-------|----------|
| `ToastContainer` | `position?` `'top-right'\|'top-left'\|'bottom-right'\|'bottom-left'\|'top-center'\|'bottom-center'` | — |
| `Toast` | `toast` `Toast` · `onclose?` (normally rendered by `ToastContainer`) | — |
| `toast` (store) | `toast.success(msg)` · `.error(msg)` · `.info(msg)` · `.warning(msg)` | — |

## User settings

| Component | Props | Snippets |
|-----------|-------|----------|
| `UserSettings` | `stores` · `providers?` · `position?` `'bottom-left'\|'bottom-right'\|'bottom-center'` · `showTheme?` · `showApiKeys?` | — |
| `UserSettingsTrigger` | `variant?` `'icon'\|'icon-label'` · `active?` · _+HTMLButtonAttributes_ | — |
| `UserSettingsPopover` | **✎ `open?`** · `position?` · `anchorElement?` `HTMLElement\|null` · `onclickoutside?` | `children` |

## Utilities

Formatters and diff helpers exported from the package root:
`formatTokens` · `formatLatency` · `formatBytes` · `formatPercent` · `formatRelativeTime`
· `formatTimestamp` · `computeDiff` · `generateUnifiedDiff`.

---

_When you add or change a component, update this table in the same change — see the
[shared-package convention](../README.md#keeping-this-current)._
