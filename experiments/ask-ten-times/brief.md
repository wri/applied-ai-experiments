---
# ---- Required ----
title: "Ask the Same Question 10 Times"
type: prototype
status: done

# ---- Recommended ----
created_at: 2026-06-10
updated_at: 2026-07-10

# ---- Classification ----
targets: capability
themes:
  - reliability
  - evals
tags:
  - nondeterminism
  - uncertainty

# ---- Demo ----
demo:
  enabled: true
  type: sveltekit
  build_command: "pnpm build"
  output_dir: "demo/dist"
---

# Ask the Same Question 10 Times

> An experiment console for LLM variability. Run the same question N times, then read a claim heatmap that shows which ideas are stable across the runs and which are fragile.

## Before

### What problem or question does this address?

A user should experience nondeterminism directly, fiddling with model temperature is a good way to do that.

For analytical or policy work, it's important to build intuitions about what the stochastic nature of LLM responses can look like in an area you know well, across different tiers of models. Can a simple fan-out console help convey a useful mental model for building these intuitions?

Primary theme: **reliability**. As a testing surface it could inform a couple of things. How consistent are LLM responses for deep domain questions across models tiers, and might it be prudent to consult a second stochastic opinion in some circumstances?

### What does this experiment actually do?

A browser-only SvelteKit demo (BYOK).

1. The user enters a question and picks the model, the temperature, and N. Meaning-preserving paraphrases are optional.
2. N concurrent calls stream into cards.
3. A second-stage analysis call extracts the claims and maps which runs contain each one.
4. A claim heatmap renders the result, where rows are claims and columns are runs.
5. A consensus summary reports the stable points, the disputed points, the rare but important points, a recommended answer, and a confidence assessment.

### What signals are we looking for?

- **Success** — On a real question, the heatmap reliably shows a mix of dense rows, which are stable claims, and sparse rows, which are fragile claims, and that representation makes sense to folks.
- **Failure** — The claim-extraction judge is too noisy to trust, or N runs feel too slow and expensive to be worth it.

### What are the boundaries?

- Aiming to show simple claim-presence mapping, an LLM judge with inspectable prompt.
- Not doing embedding-based clustering in this pass.

---

## Learnings

- Tinkering with parameters and seeing variations of answers for the same question can be a useful way to build intuitions about how models work.
- Newer models are stochastic, but way less funky than they used to be. I don't know if you folks ever ran GPT-2 with temperature > 0.8 for kicks, just saying it would have been bonkers in this lineup.

---

## After

**Outcome:** Confirmed (capability only, more feedback pending): the demo shows a mix of dense and sparse rows on questions, and that is at least interesting.

### Signal check

- The heatmap shows a mix of dense and sparse rows on real questions — Confirmed, from live runs during development. It turns out that with the initial settings you don't need to ask ten times before the variation shows up.

Note on evidence: the session that ships for keyless visitors is an illustrative example, not one of those live runs, so it demonstrates the interface rather than evidencing the finding. Replacing it with a real export is a loose end — see the README.


### What happened?

Built a way to fan out concurrent calls, and a way to extract claims from the responses. It ended up feeling a bit like an attempt to ensemble LLM call responses across different parameters, which feels very meta.


### What would you recommend?



### What decisions and tradeoffs came up along the way?
