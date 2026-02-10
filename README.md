# WRI Applied AI Experiments

A monorepo for AI experiments developed by WRI's Applied AI Group. This repository hosts experiment code, documentation, and static demos deployed to GitHub Pages.

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

<!-- EXPERIMENTS-START -->
<!-- This section is auto-generated; do not edit by hand. -->
| Experiment | Type | Status | Description |
| ---------- | ---- | ------ | ----------- |
| [AI Provisioning Guide](experiments/ai-provisioning-guide/) | `prototype` | `started` | Interactive tool for navigating AI provisioning decisions. Includes a constra... |
| [Example Experiment](experiments/example-experiment/) | `prototype` | `idea` | A template example showing the structure of an experiment in this repository. |
| [MCP Web Map](experiments/mcp-web-map/) | `prototype` | `paused` | Chat interface for MapLibre GL JS maps, built to test whether MCP running in... |
| [Semantic Document Search](experiments/semantic-document-search/) | `prototype` | `started` | Client-side semantic search tool for PDF documents using browser-based embedd... |
<!-- EXPERIMENTS-END -->

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

## Development

### Prerequisites

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
