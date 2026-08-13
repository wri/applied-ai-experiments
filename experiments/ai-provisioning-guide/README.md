# AI Provisioning Guide

> See [brief.md](./brief.md) for context, signals, and findings.

## Setup

### Prerequisites

- Node 24+, pnpm 10+ (run `pnpm install` at the repo root — this demo is part of the workspace)

### Install & Run

```bash
# from repo root
pnpm install
pnpm --filter ai-provisioning-guide dev     # http://localhost:5173
pnpm --filter ai-provisioning-guide check   # svelte-check, strict
pnpm --filter ai-provisioning-guide build   # static build → demo/dist/
```

## How it works

### The cost model

`logic/tco.ts` computes a monthly total from four components:

| Component | How it's modelled |
|---|---|
| Inference | volume × tokens × per-million price, plus any router markup |
| Infrastructure | flat monthly |
| Development | initial build hours × rate, **amortized** over `amortizationMonths` |
| Operations | monthly hours × rate |

`calculateMethodTCOExpanded()` additionally splits upfront from recurring for the cumulative-cost
chart and the selected time horizon.

**The shipped rates are illustrative.** `SHARED_RATES` in `lib/data/defaults.ts` and costs in `defaultAssumptions` are round placeholders. At low volume, labor rates drive almost the entire total, so substitute own figures and know the aim of this tool is to show magnitude, not precision.

### The four tabs

**1. Wizard** — five constraint questions (budget, privacy, capability, latency, reliability). Each option in `lib/data/constraints.ts` carries explicit per-method viability rules; methods not listed for an option default to viable. `logic/viability.ts` resolves them into viable / caution / eliminated.

**2. Calculator** — the cost model above, with every assumption on a slider, charts for cost breakdown, volume curves and per-request cost, an insights panel pointing at dominant cost category.

**3. Compare** — side-by-side across operational, control, capability and risk dimensions.

**4. Guide** — the narrative decision walkthrough.

## Eight delivery methods

`byok` · `provider_direct` · `managed_router` · `self_built_proxy` · `managed_inference` · `full_self_hosted` · `edge_browser` · `hybrid`

This seemed like a decent set to start with. Lines might be a little blurred between a few of them, but the set is deliberately narrow for legibility.

## What's in here

```
demo/
├── src/
│   ├── routes/                    # +layout.svelte, +layout.css, +layout.js, +page.svelte (tab shell)
│   └── lib/
│       ├── data/
│       │   ├── methods.ts         # The eight delivery methods + their properties
│       │   ├── constraints.ts     # Five wizard questions + per-method viability rules
│       │   ├── defaults.ts        # Default TCO inputs, shared rates, per-method assumptions,
│       │   │                      #   slider ranges, horizons, chart + insight config
│       │   ├── comparisons.ts     # Compare-table dimensions
│       │   └── guide.md           # Narrative decision guide
│       ├── logic/
│       │   ├── tco.ts             # The four-component cost model
│       │   ├── insights.ts        # Dominant-category insights + findCrossoverVolume()
│       │   └── viability.ts       # Worst-case-wins constraint resolution
│       ├── components/
│       │   ├── wizard/            # WizardView, ConstraintQuestion, MethodCard, ResultsSummary
│       │   ├── calculator/        # CalculatorView, AssumptionsPanel, AssumptionSlider,
│       │   │                      #   AssumptionsReference, InsightsPanel, VolumeInputs
│       │   ├── compare/           # CompareView
│       │   ├── guide/             # GuideView
│       │   └── shared/            # PlotContainer, RadioCards, ViabilityIndicator
│       ├── stores/app.svelte.ts   # Shared app state (Svelte 5 runes)
│       ├── utils/                 # URL encoding, export, formatting
│       └── types.ts
└── static/favicon.svg
```
