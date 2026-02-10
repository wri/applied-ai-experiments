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
│   ├── components/   # Reusable Astro components
│   ├── layouts/      # Page layouts
│   ├── pages/        # Route pages (index, experiment details)
│   ├── styles/       # Global styles and design tokens
│   └── utils/        # Helper functions
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
- Experiment demos are built separately and served from `/{slug}/`

## Related Commands

```bash
just build-hub        # Build hub only
just dev-hub          # Run hub dev server
just test-build       # Full build (hub + demos)
just test-build-serve # Build and serve locally
```
