# @wri/shared-types

Shared TypeScript types for WRI experiments. These types match the `info.yaml` schema and `experiment-index.json` structure.

## Installation

From an experiment's demo or from the hub:

```bash
pnpm add @wri/shared-types
```

Or in `package.json`:

```json
{
  "dependencies": {
    "@wri/shared-types": "workspace:*"
  }
}
```

## Usage

```typescript
import type { Experiment, ExperimentIndex, ExperimentType } from "@wri/shared-types";

// Type-safe experiment handling
function filterByType(
  experiments: Experiment[],
  type: ExperimentType
): Experiment[] {
  return experiments.filter((e) => e.type === type);
}

// Use valid theme constants
import { VALID_THEMES } from "@wri/shared-types";
console.log(VALID_THEMES); // ['cost-perf', 'evals', ...]
```

## Available Types

| Type | Description |
|------|-------------|
| `Experiment` | Full experiment metadata from info.yaml |
| `ExperimentIndex` | Structure of experiment-index.json |
| `ExperimentType` | Union of valid experiment types |
| `ExperimentStatus` | Union of valid status values |
| `DemoConfig` | Demo configuration object |
| `Owner` | Experiment owner information |
| `Theme` | Union of valid theme values |

## Why This Package?

This package ensures type consistency across:
- The hub site
- Experiment demos
- Build scripts and tooling

When the schema changes, update types here and TypeScript will catch any inconsistencies.
