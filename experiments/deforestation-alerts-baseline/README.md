# Deforestation Alerts Baseline Analysis

A spike to test whether pixel-level deforestation alert data from the GFW API
can be processed into a baseline, analyzed against a target month, and
translated into a policy-oriented narrative via LLM. Implemented for Tesso
Nilo National Park, Indonesia (July 2023). See [brief.md](./brief.md) for
context and findings, and [pipeline.md](./pipeline.md) for the full technical
walkthrough.

## Background: Places to Watch collaboration

This experiment was developed in collaboration with WRI's
[Places to Watch](https://gfw.global/KWZV0t) (PTW) program, which identifies
protected areas at elevated deforestation risk.

Key collaboration milestones:
- **December 2023** — Initial meetings with the PTW team to discuss the
  experiment concept, identify a target site, and understand the target
  audience. Tesso Nilo National Park (Riau, Indonesia) was selected as the
  test case — a high-profile PTW site with documented encroachment pressure
  and a well-defined AOI.
- **January 2024** — Shared an LLM-generated narrative summary for July 2023
  with the PTW team. Follow-up discussion surfaced open questions about
  improving the seasonal baseline and better defining the target persona.

A shared collaboration document was used to capture discussion notes, define
user personas, and develop the `USER_NEEDS` prompt variable.

## What's in here

```
├── src/
│   ├── explore_api.py          # Notebook: GFW API exploration and data validation
│   └── baseline_analysis.py    # Notebook: baseline computation and trend analysis
├── data/
│   ├── API_query_alerts_tesso_nilo_july2023.txt   # Reference API request from PTW team
│   ├── JSON_response_alerts_tesso_nilo_july2023.txt  # Reference API response (9,791 records)
│   └── ptw_tesso_nilo_july_2023.zip               # Shapefile of the Tesso Nilo AOI
├── artifacts/
│   ├── prompt_template.md          # Prompt template with {{VARIABLE}} placeholders
│   ├── prompt_variables.md         # Filled-in variable values
│   └── ai_summary_deforestationalert_tesso_nilo_july2023.md  # LLM-generated output (Jan 2024)
├── notes/
│   ├── findings.md     # Spike findings and recommendations
│   └── log.md          # Chronological work log
├── pipeline.md         # End-to-end flow: inputs → baseline → prompt → narrative
└── brief.md            # Full experiment brief with before/after
```

## Running the notebooks

Setup and usage to run the notebooks. 

Prerequisites
- Python 3.13+
- `uv` must be installed
- A WRI Data API key (contact the GFW team)

Environment variables
- Set `WRI_DATA_API_KEY` before running the notebooks. 
    - optional use mise or .env files to manage environment variables

Run the notebooks
- Both notebooks are self-contained marimo scripts with inline dependencies. 
- Run from the `src/` directory:

```bash
# API exploration and data validation
cd src/
uv run marimo edit --sandbox explore_api.py

# Baseline computation and trend analysis
uv run marimo edit --sandbox baseline_analysis.py
```

## Open questions

See the recommendations in [brief.md](./brief.md).

