---
# ---- Required ----
title: "Deforestation Alerts Baseline Analysis"
type: spike
status: done

# ---- Recommended ----
created_at: 2023-12-08
updated_at: 2024-01-21

# ---- Classification ----
targets: feature
themes:
  - geospatial
tags:
  - deforestation
  - places-to-watch

# ---- Demo (when there's something to show) ----
demo:
  enabled: false
---

# Deforestation Alerts Baseline Analysis

> A proof-of-concept pipeline for generating policy-oriented deforestation alert summaries for Places to Watch sites. Queries the GFW Integrated Alerts API to build a temporal baseline, analyzes a target month against it, and produces a narrative via LLM. Implemented for Tesso Nilo National Park, Indonesia (July 2023).

Scoped with the Places to Watch team: the GFW Integrated Alerts dataset, Tesso Nilo National Park in Indonesia, and 2–3 target personas the summary would be written for.

## Before

### What problem or question does this address?

Could an LLM write a useful summary of pixel-level GFW deforestation-alert data?

Places to Watch (PTW) identifies protected areas at elevated deforestation risk, but alert data needs interpretation before policy makers, journalists, or practitioners can use it. Today there are two options and nothing between them:

- **PTW reports** — high value, but months of work in collaboration with Mongabay, who author the stories. The reports draw on WRI datasets, including the Deforestation Alerts dataset.
- **GFW alert subscriptions** — fully automated, but the outputs are hard to interpret and of low value to many users.

**This experiment looks for the middle ground:** an automated or semi-automated summary with more interpretation than a subscription alert and far less effort than a PTW report.

### What does this experiment actually do?

A three-step pipeline: query the GFW Integrated Alerts API for a temporal baseline over the AOI, analyze a target month against it, then build a structured prompt and generate a policy-oriented narrative. Full walkthrough in [pipeline.md](./pipeline.md).

### What signals are we looking for?

- **Success:** output is accurate and coherent enough for a policy analyst to use without significant editing, and the pipeline is clear enough to replicate for another PTW site.
- **Failure:** factual errors, a misread baseline, or so much expert correction that there's no time saved.
- **Hypothesis:** with carefully built prompt variables — especially `DATASET_INFO` (alert-methodology caveats) and `USER_NEEDS` (target audience) — the LLM produces a first draft an expert refines in minutes rather than hours.

### What are the boundaries?

- Single site, single month (Tesso Nilo, July 2023); text output only — no visualization, no automated delivery.
- No formal evaluation against expert-written summaries.
- Prompt variables pasted manually into the Claude Workbench.
- Alert classification (fire vs. clearing vs. natural) is out — that data lags ~90 days.

---

## Learnings

- The seasonal baseline was insufficient: comparing July 2023 only to the prior 12 months misses year-over-year seasonality and needs more historical depth. July should be compared to prior Julys, not just the rolling average — this was the primary methodological weakness.
- Variable quality dominates output quality. The structure of the prompt mattered less than the content of the variables; getting `DATASET_INFO` right — especially the caveats about what integrated alerts represent and don't — was the single most important factor in narrative accuracy.
- The narrative handles uncertainty well when given the right context. The LLM correctly surfaced caveats about confirmation lag, driver uncertainty, and the baseline representing ongoing degradation rather than an intact reference condition — because `DATASET_INFO` carried that context.
- LLM narrative quality was high enough to share with partners, but the interpretation of the alerts dataset needs improvement before this pipeline could be used operationally.
- The approach is replicable and can be automated, but basic, and has not yet found a use case that generates value.

---

## After

**Outcome:** Confirmed (feasibility only): demonstrated feasibility and a possible approach for
an automated baseline-to-narrative pipeline for geospatial data. However, deforestation alert
data specifically requires a different interpretation and may not ultimately be suited for this
baseline-driven approach.

### Signal check

- **Accurate, coherent, usable without significant editing** — **Inconclusive — never formally assessed.** The narrative was judged good enough to share with PTW as a meaningful first draft, but formal evaluation against expert-written summaries was explicitly out of scope. Measuring would take that evaluation.
- **Replicable for another PTW site** — **Confirmed.** A new site needs the polygon geometry, the `REGION_OF_INTEREST` text, and the target date; the rest is reusable.
- **Failure condition (errors, misread baseline, no time saved)** — **Inconclusive — partially observed.** No factual errors were reported and the right caveats surfaced, but the seasonal baseline is a real methodological weakness and time savings were never measured.
- **Hypothesis: good variables yield a minutes-not-hours draft** — **Inconclusive — the mechanism held, the time claim didn't get tested.** Variable quality clearly dominated output quality, but expert refinement time was never clocked.

### What happened?

Implemented end-to-end over six weeks (Dec 2023 – Jan 2024) with the PTW team. Python scripts queried the GFW API and computed the baseline. Prompt variables were assembled separately: `DATASET_INFO` compressed from the GFW tech note, `USER_NEEDS` from a PTW collaboration document, `REGION_OF_INTEREST` from Wikipedia. The prompt was drafted and tested in the Claude Developer Workbench, and the narrative went to the PTW team on 21 January 2024, with context on the pipeline and open questions about improving the seasonal baseline and refining the target persona.

The team's response surfaced two areas for follow-up: correct and improve the interpretation of the alerts dataset, and better translate the analysis into the language and format most useful for their target audience. Both are carried into the recommendations below.

### What would you recommend?

- **Revisit the dataset choice.** Integrated Alerts methodology and interpretation may not fit this use case. Either revise the approach with expert input or pick a different target dataset.
- **Refine `USER_NEEDS` with the PTW team** — the current version is a reasonable first pass, but the team had follow-up questions on tone and format.
- **Improve `DATASET_INFO`** on what "integrated alerts" means versus confirmed deforestation, and what the confidence levels actually represent.
- **Don't automate further yet.** Reducing technical friction before the summaries have clear and consistent value would be premature optimization.

### What decisions and tradeoffs came up along the way?

- **Integrated Alerts over GLAD** — near-real-time and carries confidence levels; GLAD integrates less information per pixel.
- **Bounding box, not the park polygon** — a hardcoded approximation of the Tesso Nilo grid cell kept the first query simple. The real polygon would be more precise.
- **High + highest confidence only** — excluding nominal-confidence alerts cuts noise but undercounts total disturbance, a caveat the first draft didn't fully surface.
