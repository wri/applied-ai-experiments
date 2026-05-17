# Spike Log

Chronological summary of key milestones for the deforestation alerts baseline
spike.

---

## December 8, 2023 — Kickoff meeting with Places to Watch team

First meeting with the PTW team. Discussed the experiment concept: using GFW
alert data to generate automated, site-specific summaries for policy audiences.

Key outcomes:
- Selected Tesso Nilo National Park (Riau, Indonesia) as the target site —
  a high-profile PTW location with well-documented encroachment pressure and
  a clear AOI
- Began discussion of target personas; multiple candidates considered
  (journalists, policy analysts, conservation practitioners)
- PTW team shared a reference API request and response for July 2023
  (`data/API_query_alerts_tesso_nilo_july2023.txt` and
  `data/JSON_response_alerts_tesso_nilo_july2023.txt`)
- Started a shared collaboration document to capture notes, persona
  definitions, and `USER_NEEDS` content

---

## December 28, 2023 — First pass on `BASELINE_DATA` and `REGION_OF_INTEREST`

Working session to populate the first two prompt variables.

- **`REGION_OF_INTEREST`:** Sourced from Wikipedia; describes Tesso Nilo's
  location, ecological significance, and encroachment history. Required minimal
  editing.
- **`BASELINE_DATA`:** First version computed from the GFW API, covering a
  rolling baseline period. Explored the API query structure and validated
  results against the PTW team's reference data.

Questions raised:
- Is a rolling 12-month window sufficient for seasonal comparison, or do we
  need year-over-year same-month data?
- How should the baseline summary be formatted for the LLM — statistics table,
  prose, or both?

---

## January 12, 2024 — Major work session: notebooks and prompt draft

Longer work session to build the analysis notebooks and draft the complete prompt.

- Built `explore_api.py`: notebook with python code for ad-hoc API queries,
  reference data validation, and data structure exploration
- Built `baseline_analysis.py`: full baseline computation pipeline — monthly
  queries, high/highest confidence filtering, summary stats, Altair trend
  charts, and seasonal same-month comparisons (July 2020, 2021, 2022, 2023)
- Drafted the complete prompt in the Claude Developer Workbench, including
  system prompt and five-variable user prompt template
- First test runs with all variables populated; iterated on `DATASET_INFO`
  and `USER_NEEDS` based on output quality
- Selected persona: **policy analyst at an international environmental
  NGO**

---

## January 21, 2024 — Narrative generated and shared with PTW team

- Final prompt run in Claude Developer Workbench with all variables populated
- Narrative reviewed and confirmed as a strong first draft
- Shared with the PTW team via email with context on the pipeline and open
  questions about improving the seasonal baseline and refining the target
  persona
- PTW team response surfaced two areas for follow-up: (1) correct/improve the
  interpretation of the alerts dataset, and (2) better translate the analysis
  to language and format most useful for their target audience
