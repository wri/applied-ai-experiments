# Comparing LLM Models for WRI Tasks

> A practical exploration of which LLMs perform well on WRI-relevant tasks,
> and what it costs to run them. The goal is to build reusable tooling for
> model comparison and develop intuitions that inform future model
> selection decisions.

## Before 

### What problem or question does this address? 


WRI teams evaluating or building AI-assisted tools face a recurring
question: which model should we use? The options vary widely in capability,
cost, latency, and licensing. 

There's no team-shared baseline for how different models actually behave on
the kinds of prompts that matter to us. 

This experiment provides demonstration tooling to help develop 
intuitions for these questions. 

### What does this experiment actually do? 

Builds an interactive notebook that sends the same prompt to multiple LLMs
simultaneously, then displays each model's response. 

The user can also inspect a comparison of latency, token usage, and cost.

Langfuse captures all traces for deeper analysis.


### What signals are we looking for?

- Do different models give meaningfully different answers to the same
prompt?
- Are there models that are clearly better or worse for specific prompt
types?
- What does cost variation look like across quality tiers?
- Is the tooling stack (LiteLLM + OpenRouter + Langfuse) practical for
ongoing use by the team? 


### What are the boundaries?

- This is exploratory, not a framework, not a benchmark.
- Focus on text generation (no vision, audio, tool calling, etc. 
- No formal evaluation harness. 


---

## After

_Fill this section out when the experiment concludes or is stopped._

### What happened?

What did you actually do? (Often different from what you planned.)

### What did you learn?

The 2–5 findings someone should take away. Include what surprised you and what confirmed expectations.

### What would you recommend?

Should we adopt this, keep exploring, stop, share it, build on it? Be direct.

### What decisions and tradeoffs came up along the way?

Non-obvious choices you made during the work. Things you tried that didn't work. Forks in the road and which way you went and why. These are often more valuable than the main findings.
