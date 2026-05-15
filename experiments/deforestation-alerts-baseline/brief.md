# Deforestation Alerts Baseline Analysis

Starting question: 
> Could an LLM provide a useful AI summary of pixel-level geospatial data
> from the GFW dataset? 

To run an experiment, we needed to identify a target dataset from GFW for
such an LLM summary, and work with experts to identify a use-case and
audience that would be an appopriate target for this experiment. 

For this first experiment, we 
* experts were the Places to Watch team
* worked with the GFW deforestation alerts dataset
* targeted Tesso Nilo National Park in Indonesia
* identified 2-3 target personas / user profiles for whom the AI summary
would be written. 


## Before

### What problem or question does this address?

The Places to Watch (PTW) program identifies protected areas at elevated
deforestation risk, but communicating alert data to policy makers, journalists,
and conservation practitioners requires interpretation. 

Current PTW process is intensive and time-consuming. Often taking
several months, and involving a collaboration with a partner with MongoBay,
who author stories and articles about locations identified in collaboration
with WRI teams. The reports utilize WRI datasets, including the
Deforestation Alerts dataset. 

Link to example: tdtd

There is also a completely hands-off alerts system available to GFW users.
In this case, the users select an area of interest and receive periodic
alert messages. However these outputs are apparently hard to interpret and
of low valuable to many users. 

Link to example: tdtd

**This experiment seeks a middle ground, an automated or semi-automated
system that provides more interpretation and value than the current alerts
subscription, and is faster and simpler than the current PTW reports.**

### What does this experiment actually do?

A three-step pipeline: query the GFW Integrated Alerts API to build a
temporal baseline for the AOI, analyze a target month against it, then
construct a structured prompt and submit it to an LLM to generate a
policy-oriented narrative.

See [pipeline.md](./pipeline.md) for the full technical walkthrough.

### What signals are we looking for?

**Success:** The LLM output is accurate, coherent, and would be useful to a
policy analyst without requiring significant editing. The pipeline is
understandable well enough that it could be replicated for another PTW site.

**Failure:** The narrative contains factual errors, misinterprets the baseline,
or requires so much expert correction that it provides no time savings.

**Hypothesis:** With carefully constructed prompt variables — especially
`DATASET_INFO` (conveying the right caveats about alert methodology) and
`USER_NEEDS` (defining the target audience) — the LLM can produce a useful
first draft that a domain expert could refine in minutes rather than hours.

### What are the boundaries?

- Single site, single target month (Tesso Nilo, July 2023)
- Text output only — no visualization, no automated delivery
- No formal evaluation against expert-written summaries
- Prompt variables populated manually by copy-paste into Claude Workbench
- Does not address alert classification (fire vs. clearing vs. natural) — that
  data lags by ~90 days

---

## After

### What happened?

The pipeline was implemented end-to-end over six weeks (Dec 2023 – Jan 2024),
in collaboration with the PTW team. Python scripts were built to query
the GFW API and compute the baseline. Prompt variables were assembled
separately — `DATASET_INFO` compressed from the GFW tech note, `USER_NEEDS`
derived from a collaboration document with the PTW team, `REGION_OF_INTEREST`
sourced from Wikipedia. The full prompt was drafted and tested in the Claude
Developer Workbench. The resulting narrative was shared with the PTW team on
January 21, 2024.

\<insert the team's response and feedback here>

### What did you learn?

1. **The pipeline is feasible.** The end-to-end flow from API query to
   narrative works, and the output quality was sufficient to share with
   partners as a meaningful first draft.

2. **Variable quality dominates output quality.** The structure of the prompt
   mattered less than the content of the variables. Getting `DATASET_INFO`
   right — especially the caveats about what integrated alerts represent and
   don't represent — was the single most important factor in narrative accuracy.

3. **The seasonal baseline is insufficient.** Comparing a target month only to
   the preceding 12 months misses year-over-year seasonality. July should be
   compared to prior Julys, not just the rolling average. This was identified
   as the primary methodological weakness.

4. **The narrative handles uncertainty well when given the right context.** The
   LLM correctly surfaced caveats about confirmation lag, driver uncertainty,
   and the baseline representing ongoing degradation rather than an intact
   reference condition — because `DATASET_INFO` contained that context.

5. **Replicability is high.** Adapting the pipeline to another PTW site mainly
   requires swapping the polygon geometry, the `REGION_OF_INTEREST` text, and
   the target date. The rest is reusable.


### What would you recommend?

Recommendations: 
* Deforestation Alerts methodology and interpretation may not match the
current approach. Either needs revision with expert input, or a different
target dataset. 
* Refine `USER_NEEDS` with more input from the PTW team — the current version
  is a reasonable first pass but the team had follow-up questions about tone
  and format.
* Improve `DATASET_INFO` to better convey what "integrated alerts" means versus
  confirmed deforestation, and what the confidence levels actually represent.

Further technical automation or streamlining of the pipeline is NOT
recommended until we are able to produce AI summaries of clear and
consistent value. Reducing technical friction at this point would likely be
pre-mature optimization. 

### What decisions and tradeoffs came up along the way?

- **GFW Integrated Alerts vs. other datasets:** The integrated alerts dataset
  was chosen because it's near-real-time and provides confidence levels.
  GLAD alerts were considered but integrate less information per pixel.

- **Polygon as bounding box:** The AOI is a hardcoded bounding box
  approximation of the Tesso Nilo park grid cell, not the full park boundary
  from the shapefile. This was a pragmatic choice to keep the initial query
  simple; using the actual park polygon would be more precise.

- **High + highest confidence filter:** Nominal-confidence alerts were excluded
  to reduce noise. This is defensible but means the baseline undercounts
  total disturbance activity — a caveat not fully surfaced in the first
  narrative draft.

