# WRI Applied AI Experiments

A monorepo for AI experiments developed by WRI's Applied AI Group. This repository hosts experiment code, documentation, and static demos deployed to GitHub Pages.

> **New here? Start with [ONBOARDING.md](./ONBOARDING.md)** — a one-page path covering setup, the
> create → run → publish loop, and what to read next by role. Deeper docs live in [`docs/`](./docs/),
> and [`AGENTS.md`](./AGENTS.md) is the orientation for AI coding agents.

The published gallery is at **https://wri.github.io/applied-ai-experiments/** — the [`hub/`](./hub/)
Astro site that turns every experiment's metadata into a browsable gallery, a **Learnings** page,
and curated cross-experiment **Insights**.

## Quick Start

### Create a New Experiment

```bash
# Interactive template selection
just new-experiment

# Or specify directly
just new-experiment name=my-experiment template=prototype
```

### Available Templates

| Template | Use When |
|----------|----------|
| `evaluation` | Comparing models, methods, or approaches |
| `benchmark` | Building reusable test suites |
| `spike` | Time-boxed technical exploration (1-2 days) |
| `prototype` | Building a working demo |
| `research` | UX, design, or methodology investigation |
| `notebook` | Exploratory analysis with Jupyter |
| `marimo` | Interactive Python notebooks with marimo |

### Common Commands

```bash
just list-templates      # Show available templates
just list-experiments    # List experiments with status
just validate            # Validate experiment metadata
just generate-index      # Generate experiment-index.json
just build-demos         # Build all demos
```

## Repository Structure

```
applied-ai-experiments/
├── experiments/         # All experiments (flat structure)
├── packages/            # Shared libraries
├── hub/                 # Gallery site
├── docs/                # Repo documentation
└── .github/workflows/   # Scripts, templates, and CI/CD
```

## Experiments

Browse the [`experiments/`](experiments/) directory, or run `just list-experiments`
for a quick status overview. The [hub gallery site](hub/) renders the full catalog
from each experiment's `info.yaml`.

## Experiment Types

| Type | Purpose | Demo |
|------|---------|------|
| **evaluation** | Compare models/methods with metrics | Optional |
| **benchmark** | Reusable test suites with baselines | Often |
| **spike** | Time-boxed exploration | Rarely |
| **prototype** | Working demo of a capability | Yes |
| **research** | UX/design investigation | Rarely |
| **notebook** | Exploratory analysis | Optional |

## Themes

Experiments align with these themes:

| Theme | Description |
|-------|-------------|
| `cost-perf` | Cost, performance, and carbon optimization |
| `evals` | Evaluation and benchmarking |
| `patterns` | Product integration patterns |
| `geospatial` | Geospatial intelligence |
| `reliability` | Factuality and grounding systems |
| `agents` | Agentic workflows |
| `scouting` | Technology landscape scanning |
| `prototyping` | Feature exploration and prototyping |
| `development` | AI-assisted software development |

## Development

### Prerequisites

- python
- Node.js 24+ (for JS/TS experiments)
- [just](https://github.com/casey/just) (command runner)
- [pnpm](https://pnpm.io/) (for JS/TS workspaces)
- [uv](https://github.com/astral-sh/uv) (Python 3.12+)

### Setup

```bash
# Install Python dependencies for scripts
pip install pyyaml

# Or use uv
uv sync
```

### Validation

```bash
# Validate all experiment metadata
just validate

# Strict mode (warnings as errors)
just validate-strict
```

## Deployment

Demos are deployed to GitHub Pages when:
1. Changes are pushed to `main` with `[deploy]` in the commit message
2. Or via manual workflow dispatch

**Live site:** https://wri.github.io/applied-ai-experiments/

## License

[MIT](LICENSE)
