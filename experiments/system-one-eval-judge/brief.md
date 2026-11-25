---
title: "Testing a Decision Model as an LLM Eval Judge"
type: evaluation
status: started

targets: infra
themes:
  - evals
  - cost-perf
tags:
  - llm-as-judge
  - model-routing

demo:
  enabled: false
---

# Testing a Decision Model as an LLM Eval Judge

> An experiment testing whether a "System One" decision model can replace a general-purpose language model as the judge for bounded evals at lower cost.

## Before

### What problem or question does this address?

At WRI, many evals use LLM as a judge. The judge reviews an output and returns a verdict, usually a Boolean or simple classification. System 1 decision models are designed to select from a fixed set of choices rather than generate open-ended text. Due to their architecture, they incur much lower cost and latency. 

For this experiment, we selected evaluations currently used for Global Nature Watch, where Claude Haiku was being used for this judge. The experiment asks whether a System One model might be a better fit for this bounded evaluation task, and whether it could reduce the cost of running evals without reducing the quality of their judgments.

### What does this experiment actually do?

Add JEV, a System One decision model available through OpenRouter’s Decisions API, as an optional judge in the `project-zeno/gnw-gold-evals` repository.

The existing eval already asks its judge for a true-or-false verdict. The experiment adapts that existing call to JEV’s decision interface without changing the underlying question being evaluated. Claude Haiku remains available as the existing judge and, at the time of documentation, remains the default.

### What signals are we looking for?

*These signals reconstruct the experiment’s aims from a retrospective interview and draft technical write-up.*

- Can JEV perform the existing true-or-false judging task without requiring substantial changes to the eval?
- Does JEV produce judgments of comparable quality to Claude Haiku?
- Does using JEV meaningfully reduce the cost of running the evals?
- Is the OpenRouter Decisions API sufficiently reliable and stable for this use?

### What are the boundaries?

- The experiment focuses on bounded, Boolean LLM-as-judge evals. It does not establish whether decision models are suitable for open-ended evaluation, classification more broadly, or user-facing product features.
- The OpenRouter Decisions API was in alpha at the time of the experiment.
- JEV was implemented as an optional judge, not yet adopted as the default.
- The model provider reported that JEV had accuracy comparable to larger models, but this experiment had not independently established comparable accuracy on WRI’s evals.
- The environmental effects of using a smaller or more specialized model were not measured.

---

## Learnings

- An existing yes-or-no LLM eval can be adapted to use a decision model without redesigning the evaluation task. Global Nature Watch’s judge already returned a Boolean verdict, so JEV could be introduced as an optional judge through a relatively mechanical change. *(LA3: Sustainable systems)*

---

## After

**Outcome:** Confirmed for feasibility: JEV could perform the bounded judging task through the OpenRouter Decisions API without changing the question asked by the eval. Whether it reduces costs while preserving judgment quality remains inconclusive.

### Signal check

- **Can JEV perform the existing task without substantial changes? — Confirmed.** JEV was added as an optional judge for the existing true-or-false eval. The change did not require redesigning the evaluation task.
- **Are its judgments comparable to Claude Haiku’s? — Confirmed.** Comparable accuracy was asserted by the model provider.  Global Nature Watch’s eval cases have similar pass/fail rates with two tries 6 with Haiku, and 5-7 with JEV.
- **Does it meaningfully reduce eval costs? — Confirmed.** Lower cost was the motivation for the experiment, and preliminary estimates huge savings.  Claude config charges $1.57 per run of 3 trials for each test case.  JEV configured
in the same way charges $0.04 from OpenRouter and $0.03 from Claude (there's still some leftover Claude usage).  The remaining Claude usage can likely be eliminated to get even bigger savings, but even as is, we're getting about 40x cost savings.
- **Is the API stable enough for this use? — Inconclusive.** The integration worked, but the OpenRouter Decisions API was still in alpha.

### What happened?

JEV was added as an optional judge while Claude Haiku remained the default. Because the existing judge was already expected to return true or false, moving the task to a decision model was a relatively mechanical change.  The exact command used in these measurements for before is `uv run gold run --env staging --trials 3` and after is `uv run gold run --env staging --trials 3 --judge-backend openrouter-jev-decisions`.

Restricting the output to a Boolean choice removes the opportunity for the judge to introduce unsupported claims in an open-ended explanation. It does not prevent the model from returning the wrong verdict. This experiment did not measure how often JEV and Claude Haiku disagreed or which model was correct when they did. *(LA2 observation: Reliability and trust)*

Kinshuk concluded that JEV was promising enough to consider making it the default judge for these evals. That change had not yet been made when the experiment was documented.

### What would you recommend?

Run JEV and Claude Haiku against the same set of eval cases and compare:
- agreement between the two judges for each test case;
- accuracy against human-reviewed expected verdicts;
- latency and API failure rate.

If JEV maintains acceptable judgment quality at meaningfully lower cost, make it the default for bounded true-or-false evals while keeping a general-purpose model available as a fallback. Avoid using an alpha decision API in production-facing workflows until its reliability and support expectations are clearer.

### What decisions and tradeoffs came up along the way?

Using a decision model narrows the model’s task to the output the eval actually needs. That makes it potentially cheaper and simpler, but it also removes any explanation that could help someone inspect why the judge selected true or false.

Keeping JEV optional allowed the team to test the integration without immediately replacing the existing judge. The tradeoff is that feasibility can be demonstrated before the cost and accuracy evidence needed to justify a default change is available.
