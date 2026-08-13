---
# ---- Required ----
title: "Structured Output Lab"
type: prototype
status: done

# ---- Recommended ----
created_at: 2026-06-10
updated_at: 2026-07-27

# ---- Classification ----
targets: capability
themes:
  - patterns
  - reliability
tags:
  - structured-output
  - json-schema

# ---- Demo ----
demo:
  enabled: true
  type: sveltekit
  build_command: "pnpm build"
  output_dir: "demo/dist"
---

# Structured Output Lab

> An interactive space exploring how structured outputs operate under different conditions: paste text blobs, design a JSON Schema, and watch extraction, validation failures, and model-driven repair loops. This is intended as a surface for building some intuitions about how to approach parsing problems.

## Before

### What problem or question does this address?

Structured outputs are a very useful feature of LLMs that we don't see widely used or understood amongst teams and program partners yet. This experiment proposes building a space to explore the concept and it's utility, with a couple built in examples and a simple sandbox for open exploration.

Can a demo make schema-constrained extraction (including failure modes) legible to a non-engineer?

Primary theme: **patterns**. It familiarizes viewers with the concept of structured outputs and how they can be used to extract data from text, and helps build intuitions about what tasks this approach might be useful for.

### What does this experiment actually do?

A browser-only SvelteKit demo with three panels: messy input (sample emails/notes or pasted text), schema design (template picker plus a raw JSON Schema editor), and validated output (raw JSON, a human-readable validation trace, and a rendered table/card view). When validation fails, "Repair output" sends the errors plus the original output back to the model.

### What signals are we looking for?

Success: a viewer who has never heard of JSON Schema can run extraction on a messy email, see exactly which fields failed and why, repair them, export a CSV, and walk away with a better sense of possibilities.

Failure: the repair loop performs poorly, or validation errors read like compiler noise.

### What are the boundaries?

Sticking to some basic interaction and use cases for this pass.

---

## Learnings

- Showing how and why something failed is a helpful mechanism for building trust and understanding, but sometimes requires a lot of work to cover the failure modes comprehensively.  
- Crafting a schema is a good place to sink human effort and encode essential domain knowledge, this is a piece of machinery that can be very easy to turn over to the bots since it's so syntaxy, but it's the part of an extraction pipeline that benefits from a clear understanding of what good looks like, and can be put into a validation loop.
- Many of the newer, cheaper models perform structured output extraction well enough for most cases.

---

## After

**Outcome:** Confirmed (capability only, more feedback pending): schema-constrained extraction works end to end with messy text in, a validation trace showing which fields failed and why, a bounded repair loop, CSV out.

### Signal check


### What happened?

We built the demo and created two modes. **Template mode** offers six ready shapes: risks, action items, stakeholders, budget lines, entities, and claim and evidence. A visitor can take those for a spin to extract something useful without knowledge of JSON Schema. **Raw mode** is an editor for anyone who wants to write the schema directly.

Output renders three ways: raw JSON, a validation trace, and a shape-aware view. An object renders as cards, and an array of objects renders as a table. A parser runs the validation and surfaces the failures. "Repair output" sends the schema, the previous output, and the specific issues back to the model. It is capped at two attempts, and it records every attempt, so the trace shows the attempts separately. Valid array-of-object output exports as CSV.

### What would you recommend?



### What decisions and tradeoffs came up along the way?
