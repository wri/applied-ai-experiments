# AI Provisioning Guide

> An interactive tool to explore cost and capability tradeoffs of AI delivery methods. This includes a constraint-based decision wizard, TCO calculations, and side-by-side comparisons.  

## Before

### What problem or question does this address?

Every AI-powered feature requires a provisioning decision: how will inference happen? Existing references cover the landscape, but may not translate well to project scoping decisions. Pulling these components together in a single tool allows for a guided exploration of options and the flexibility to adjust assumptions as needed.  

### What does this experiment actually do?

1. **Wizard** — A set of common app development constraint questions (budget, privacy, capability, latency, reliability) filter delivery methods into viable / caution / eliminated tiers.
2. **Calculator** — TCO estimation with adjustable assumptions, Observable Plot charts showing cost breakdowns, volume curves, and per-request costs
3. **Compare** — side-by-side table of selected methods across operational, control, capability, and risk dimensions
4. **Guide** — A basic, narrative decision guide

### What signals are we looking for?

- Can someone unfamiliar with the provisioning landscape use the wizard to narrow down to a few viable options in jsut a couple minutes?
- Does the TCO calculator surface non-obvious cost differences (e.g., operations costs dominating inference costs at low volume)?
- Is the tool useful enough that teams reach for it when scoping a new AI-powered feature?

A clear failure would be if the constraint filtering is too coarse (everything stays "viable") or if the TCO model is so simplified that teams don't trust the numbers.

### What are the boundaries?

- Keep this focused on surfacing the right magnitude of TCO differences between delivery methods, not connected to real billing data.
- Scoped to the decision framework only; doesn't cover implementation guidance

---

## After

_Fill this section out when the experiment concludes or is stopped._

### What happened?

### What did you learn?

### What would you recommend?

### What decisions and tradeoffs came up along the way?
