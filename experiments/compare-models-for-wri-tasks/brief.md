---
# ---- Required ----
title: "Comparing LLM Models for WRI Tasks"
type: marimo
status: started
created_at: 2026-01-30
updated_at: 2026-05-15

# ---- Classification ----
targets: capability
themes:
  - evals
  - cost-perf
tags:
  - litellm
  - langfuse

# ---- Demo (when there's something to show) ----
demo:
  enabled: false
---

# Comparing LLM Models for WRI Tasks

> Interactive tool for sending the same prompt to multiple LLMs in parallel and comparing responses, latency, token usage, and cost. Uses LiteLLM + OpenRouter for model access and Langfuse for observability.

## Before

### What problem or question does this address?

Which LLMs perform well on WRI-relevant tasks, and what do they cost? Build reusable comparison
tooling and the intuitions that inform future model choices.

Teams building AI-assisted tools keep hitting the same question: which model should we use? The options vary widely in capability, cost, latency, and licensing, and there's no team-shared baseline for how they behave on the prompts that matter to us. This provides demonstration tooling to build those intuitions.

### What does this experiment actually do?

An interactive notebook that sends one prompt to multiple LLMs at once and shows every response side by side, with a comparison of latency, token usage, and cost. Langfuse captures all traces for deeper analysis.

### What signals are we looking for?

- Do different models give meaningfully different answers to the same prompt?
- Are some clearly better or worse for specific prompt types?
- How much does cost vary across quality tiers?
- Is the stack (LiteLLM + OpenRouter + Langfuse) practical for ongoing team use?

### What are the boundaries?

Exploratory — not a framework, not a benchmark, no formal evaluation harness.

---

## Learnings


---

## After

_Fill this section out when the experiment concludes or is stopped._

### Signal check

Answer each signal from "What signals are we looking for?" explicitly: **Confirmed** / **Refuted** / **Inconclusive — because X**. "We didn't measure it" is valid, but say what it would take to measure.

### What happened?

What did you actually do? (Often different from what you planned.)

### What would you recommend?

Should we adopt this, keep exploring, stop, share it, build on it? Be direct.

### What decisions and tradeoffs came up along the way?

Non-obvious choices you made during the work. Things you tried that didn't work. Forks in the road and which way you went and why. These are often more valuable than the main findings.
