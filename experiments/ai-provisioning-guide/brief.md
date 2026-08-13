---
# ---- Required ----
title: "AI Provisioning Guide"
type: prototype
status: done

# ---- Recommended ----
created_at: 2026-01-30
updated_at: 2026-06-10

# ---- Classification ----
targets: feature
themes:
  - patterns
  - cost-perf
tags:
  - decision-support
  - tco-calculator

# ---- Demo ----
demo:
  enabled: true
  type: sveltekit
  build_command: "pnpm build"
  output_dir: "demo/dist"
---

# AI Provisioning Guide

> Interactive tool for navigating AI provisioning decisions. Includes a constraint-based decision wizard, TCO calculator with adjustable assumptions, side-by-side method comparison, and a basic reference guide.

## Before

### What problem or question does this address?

Every AI-powered feature needs a provisioning decision: how will inference happen? Existing references cover the landscape but don't translate well to project scoping. One tool that pulls them together allows guided exploration with adjustable assumptions.

Primary theme: **patterns**. It informs which delivery method a team picks when scoping a new feature, and helps contextualize how useful arguing about token prices might or might not be given the operating volumes expected.

### What does this experiment actually do?

1. **Wizard** — constraint questions (budget, privacy, capability, latency, reliability) filter delivery methods into viable / caution / eliminated.
2. **Calculator** — TCO estimation with adjustable assumptions and charts for cost breakdown, volume curves, and per-request cost.
3. **Compare** — side-by-side table across operational, control, capability, and risk dimensions.
4. **Guide** — a narrative decision walkthrough.

### What signals are we looking for?

- Someone unfamiliar with the landscape narrows to a few viable options in a couple of minutes.
- The TCO calculator surfaces non-obvious cost differences — e.g. operations dominating inference at low volume.
- Teams actually reach for it when scoping a new feature.

### What are the boundaries?

- **Scope:** magnitude of TCO differences between methods, not real billing data. Decision framework only — no implementation guidance.
- **Time box:** open-ended, built in intermittent passes.
- **Not doing:** real cost data, per-provider price tracking, or any recommendation about *which model* to use once a delivery method is chosen.

---

## Learnings

- Relative cost center magnitude depends largely on the scale of usage. At low volumes, it can be a rounding error relative to staff time and operational costs. At very high volumes that pattern flips and inference costs get prohibitively steep, even when building with cheaper models.
- Sometimes the useful output of a cost model is a UX with reactive levers and the crossover volume, not the total projected figures.
- Decision tools should show the reasoning at every decision gate, not just the results.
- Exposing every cost assumption as an editable input is a very helpful trust mechanism, when that can be surfaced without overwhelming users or complexifying implementation it's a welcome feature.
- Delivery-method options multiply combinatorially; a provisioning guide needs to stay deliberately narrowed on a constrained option set (eight methods here) or things get messy.

---

## After

**Outcome:** Confirmed (cost-shape only): modeling operations and development alongside inference options shows where costs accumulate for differently shaped projects. Initial feedback suggests the utility of this tool in an early project scoping phase has less to do with specific budgeting capabilities, and more as an educational venue that introduces different usage patterns/concepts, and as a forcing function to name assumptions and how they drive projected costs.

### Signal check

- Narrows to a few viable options in a couple of minutes — **Confirmed.** Helpful as a sort of educational starter tool with some additional bells and whistles.
- The calculator surfaces non-obvious cost differences — **Confirmed.** At the shipped defaults, cost shapes shift from operations to inference as volume increases with helpfull crossover details.
- Teams reach for it when scoping a new feature — **Inconclusive.** Some initial feedback, but no consistent record.
- Failure: model too simplified to trust — **Partly confirmed.** Feedback treated it as an educational tool more than a budgeting one. That's close to the stated boundary, but it does mean the numbers aren't carrying much weight on their own.

### What happened?

Built four tabs over one shared state model, covering eight delivery methods (BYOK, provider-direct, managed router, self-built proxy, managed inference, full self-hosted, edge/browser, hybrid). State is URL-encoded, so a configured scenario is a shareable link, and results export.

Initial feedback suggests the utility of this tool in an early project scoping phase has less to do with specific budgeting capabilities, and more as an educational venue that introduces different usage patterns and concepts, and as a forcing function to name assumptions and how they drive projected costs. That was roughly the intent. The specifics will drift as practices evolve, but some of the concepts should stick.

Some of the language and concepts remain clunky and technical — the "wizard" aimed at people new to this still assumes some thematic vocabulary beyond the basics. And the field moves fast: token costs and privacy-constrained inference were more pressing when this started than they are now.

### What would you recommend?

- It's a shareable reference, but not a proper budgeting tool. It'd make a reasonable starting point for the concepts and for a first-order approximation.

### What decisions and tradeoffs came up along the way?

- It's more important for this to illustrate relative magnitudes than to deliver precise numbers. Illustrative rates, coarse components, everything editable.
- Development amortized over 12 months is a big oversimplification, there are a number of shortcuts in here to make it easier to work with, but that make it less practical as a budgeting tool.
- A simplified taxonomy of methods and assumptions, with per-method cost customization on top. Options multiply quickly, and the narrow set plus editable inputs balanced utility and complexity reasonably well.
- URL-encoded state is convenient. An edited scenario is a link, so sharing is simple and there's no backend.
