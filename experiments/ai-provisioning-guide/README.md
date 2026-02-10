# AI Provisioning Guide

> Interactive tool for navigating AI provisioning decisions at WRI. See [brief.md](./brief.md) for the full context and findings.

## Setup

### Prerequisites

- Node 24+
- pnpm 10+
- Monorepo dependencies installed (`pnpm install` from root)

### Install & Run

```bash
# From monorepo root
pnpm install
pnpm --filter ai-provisioning-guide dev
```

### Build

```bash
pnpm --filter ai-provisioning-guide build
```

Output goes to `demo/dist/`.

## What's in here

```
├── demo/
│   └── src/
│       ├── routes/           # SvelteKit pages (+page.svelte, +layout.svelte)
│       └── lib/
│           ├── components/   # Wizard, Calculator, Compare, Guide views
│           ├── data/         # Methods, constraints, comparisons, guide markdown
│           ├── logic/        # TCO calculation
│           ├── stores/       # App state
│           └── utils/        # URL encoding, exporting, formatting
├── brief.md                  # Experiment context and findings
├── info.yaml                 # Experiment metadata
└── README.md                 # This file
```

## Decisions & Learnings Log

- Discovering more options and variations of delivery methods as we go, but need to narrow down to manageable set of options for the sake of legibility.  
- Lots of variability comes from upfront cost assumptions, ability to tweak assumptions and see how it affects scenarios is helpful.  
- Area of utility is understanding magnitude of TCO differences based on project scale and time horizon.  

## Future Work

- Connect with teams at scoping phase to get more realistic assumptions and feedback.  


## Results

_Summary of findings once the experiment is complete. Link to [brief.md](./brief.md) for the full write-up._
