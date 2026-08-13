# Experiments Hub

Astro-based gallery site that aggregates all experiments and their demos.

## Development

```bash
cd hub
pnpm install
pnpm dev          # Local dev server (no base path)
pnpm build        # Production build
pnpm preview      # Preview production build
```

## Structure

```
hub/
├── src/
│   ├── assets/       # Fonts and images processed at build time
│   ├── components/   # Reusable Astro components
│   ├── data/         # taxonomy.json — theme + targets display metadata
│   ├── layouts/      # Page layouts
│   ├── pages/        # Route pages (index, experiments, themes, learnings, insights, og)
│   ├── styles/       # global.css only — design tokens come from @wri-datalab/ui
│   ├── utils/        # Helper functions (experiments.ts, og.ts)
│   └── content.config.ts  # Astro content collection schema for insights/
├── public/           # Static assets
└── astro.config.mjs  # Astro configuration
```

## Build Configuration

The hub supports two build modes controlled by `LOCAL_DEV` environment variable:

| Mode | Base Path | Output Dir | Use Case |
|------|-----------|------------|----------|
| Production | `/applied-ai-experiments` | `dist/hub` | GitHub Pages deployment |
| Local Dev | `/` | `dist` | Local testing with `just test-build-serve` |

## Data Sources

- `experiment-index.json` - Auto-generated index of all experiments (from `.github/scripts/generate-index.py`)
- Experiment demos are built separately and served from `/applied-ai-experiments/{slug}/`
  in production (`/{slug}/` under `LOCAL_DEV=true`)

## Related Commands

```bash
just build-hub        # Build hub only
just dev-hub          # Run hub dev server
just test-build       # Full build (hub + demos)
just test-build-serve # Build and serve locally
```
