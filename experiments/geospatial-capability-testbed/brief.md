---
# ---- Required ----
title: "Geo Capability Testbed"
type: benchmark
status: started

# ---- Recommended ----
created_at: 2026-08-18
updated_at: 2026-09-08

# ---- Classification ----
targets: capability
themes:
  - evals
  - geospatial
tags:
  - attribution
  - aqueduct

# ---- Demo (when there's something to show) ----
demo:
  enabled: true
  type: sveltekit
  build_command: "pnpm build"
  output_dir: "demo/dist"
---

# Geo Capability Testbed

> A test rig for measuring how well AI agents handle geospatial tasks on WRI data. We look at different parts of the agent stack (model, documentation, tools, agent setup) to see how they impact performance.

## Before

### What problem or question does this address?

AI agents are showing up in our logs more and more proding at datasets. We don't know how effective they are with the tasks they are given, and we want to understand better what configurations and factors impact performance the most. This test could inform where WRI spends limited time and effort in the data publication process to make datasets work well with agents to make this access pattern cost users fewer tokens and WRI less egress per user.

### What does this experiment actually do?

Builds a harness and runs a fixed task set through it, changing one factor at a time.

- **12 frozen tasks**, one per skill type per dataset: comprehension, planning, simple math, spatial analysis, multi-step analysis, and bad or ambiguous requests. Each has a known correct answer and a scoring rubric.
- **Five levels of documentation**, from "here's the file" up to "here's how to do the task". Each level adds one thing, so we can tell what structure, extra facts, and task guidance gains in performance.
- **Two tool setups.** One without geospatial Python libraries and one with.
- **Three agent styles.** Direct answer (a control), reactive tool use, and plan-then-execute-then-verify.
- **Scoring with hard gates**, a budding failure taxonomy, and an append-only results store.

### What signals are we looking for?

- **Attribution.** A clear non-zero effect with a real model shows some performance gradient that provides information.
- **Metadata and docs contributions are distinct.** Adding structure, adding facts, and adding task guidance each show up as separate effects rather than blurring into a general "docs help" result.
- **The tasks discriminate.** Pass rates should land between 20% and 80% with a real model.


### What are the boundaries?

- **May run a pared-down batch of combos.** To limit API costs, since some combinations may be duplicative.


---

## Learnings




---

## After


### Signal check


### What happened?


### What would you recommend?


### What decisions and tradeoffs came up along the way?
