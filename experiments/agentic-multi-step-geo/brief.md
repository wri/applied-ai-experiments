---
# ---- Required ----
title: "Agentic Multi-Step Geospatial Analysis"
type: benchmark
status: done

# ---- Recommended ----
created_at: 2026-07-23
updated_at: 2026-09-08

# ---- Classification ----
targets: capability
themes:
  - agents
  - geospatial
tags:
  - eudr
  - benchmark

# ---- Demo (when there's something to show) ----
demo:
  enabled: true
  type: sveltekit
  build_command: "pnpm build"
  output_dir: "demo/dist"
---

# Agentic Multi-Step Geospatial Analysis

> A benchmark and test of whether a coding agent can run an end-to-end EU Deforestation Regulation sourcing review over live cloud-native geodata. This experiment aims to evaluate the step-by-step trajectory of multi-step agentic workflows for a specified analytical task, and to characterize performance across models and conditions.


## Before

### What problem or question does this address?

We want to test capabilities against a real and known analytical workflow that involves a series of tasks and geospatial data interpretation. Examining EUDR compliance is a concrete, high-stakes instance of an analytical chain we can verify manually. Proving that a Brazilian soy or cattle portfolio was not deforested after 31 December 2020 means resolving property IDs against the national cadastre, matching field boundaries to those properties, classifying land cover, measuring post-2020 forest loss, and routing flagged properties to a cooperative or buyer who can act on it.

### What does this experiment actually do?

Runs 60 containerized sessions of the same 31-question EUDR workflow over a 117-property portfolio in Goiás, Brazil, changing one thing per run.

- **The workflow.** Six stages that depend on each other: find the data, resolve properties in the cadastre, match fields to properties, check for deforestation, route to buyers or cooperatives, and make the portfolio appraisal.
- **The data.** Three GeoParquet catalogs on Source Cooperative, read remotely: Trazo3 Goiás 2024 field boundaries, the Brazil CAR cadastre (8.4 million rows), and a commodity-infrastructure release.
- **The harness.** One Docker run per session, fresh workspace each time.
- **The grading.** A SQL oracle works out the correct answer for each question from the same data. A comparator grades every answer automatically.
- **Two arms.** Arm A gets the task plus four policy documents that specify the rules. Arm B gets only the questions, the input list, and the catalogs.
- **The scale.** Three models (Haiku 4.5, Sonnet 5, Opus 4.8) x two arms x 10 runs = 60 sessions.

### What signals are we looking for?

1. **Strict success.** At least one model gets all 31 questions right.
2. **Reliability.** For the best model, how many questions come out the same across all 10 runs.
3. **Error propagation.** Whether accuracy per stage looks different once you account for earlier mistakes. That shows where the policy documents and metadata are a real dependency.
4. **How much the spec matters.** The two arms are an A/B test on the value of adding rich context to the task.

### What are the boundaries?

- This checks the deforestation-free condition plus some legality indicators from the cadastre, as an experiment. It's evidence that could feed a compliance decision, not a compliance verdict.
- Not covered: dropping metadata, held-out catalogs, latency and throughput.

---

## Learnings



---

## After


### Signal check


### What happened?



### What would you recommend?


### What decisions and tradeoffs came up along the way?
