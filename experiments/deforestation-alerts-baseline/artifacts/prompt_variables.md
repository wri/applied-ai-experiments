# Prompt Variables

Examples values for each `{{VARIABLE}}` in the user prompt template, as
used for the "Tesso Nilo July 2023" analysis. See `pipeline.md` for
details. 

---

## `{{DATASET_INFO}}`

_Source: GFW Integrated Alerts technical note, compressed using ChatGPT._

> **Placeholder** — the full text used in the January 2024 run was not
> retained. It described: what GFW Integrated Alerts are (a harmonization of
> GLAD-L, GLAD-S2, and RADD alert systems); what each pixel represents
> (30m vegetation disturbance signal); the three confidence levels (nominal,
> high, highest); the ~90-day lag before driver classification data is
> available; and key caveats (alerts are not confirmed deforestation; fire,
> agricultural clearing, and natural events can all trigger alerts).
>
> To reconstruct: compress the GFW Integrated Alerts tech note at
> https://www.globalforestwatch.org/help/map/guides/integrated-deforestation-alerts/
> using an LLM, retaining the methodology, confidence level definitions, and
> interpretation caveats.

---

## `{{REGION_OF_INTEREST}}`

_Source: Wikipedia, lightly edited._

Tesso Nilo National Park, located in Riau Province on the island of Sumatra,
Indonesia. The park protects one of the last remaining blocks of lowland
tropical rainforest in the region and was classified in 2019 as primary forest
of high biodiversity significance and ecological intactness. It is largely
surrounded by industrial and smallholder plantation landscapes, primarily oil
palm, creating strong edge effects and sustained pressure from agricultural
encroachment. The area has a documented history of illegal clearing and
conversion within and adjacent to park boundaries.

---

## `{{BASELINE_DATA}}`

_Source: output of `src/baseline_analysis.py`._

The script uses the API to generate qualitative and statistical summaries.
This output was then summarized with Claude Sonnet into a baseline data
summary for {{BASELINE_DATA}} 

```
Baseline period: 2020-01 to 2023-12.

Typical monthly alert count: ~85.
Dry season (Jun–Sep): 120–180 alerts/month.
Wet season (Nov–Mar): typically <50 alerts/month.
Observed maximum monthly count: ~210 alerts.
Interannual pattern: no sustained decline; persistent disturbance present
throughout baseline.
Interpretation note: baseline reflects ongoing illegal encroachment within a
protected area, not an intact reference condition.
```

---

## `{{RECENT_DATA}}`

_Source: output of `src/baseline_analysis.py`, single-month query._

The script uses the API to generate qualitative and statistical summaries.
This output was then summarized with Claude Sonnet into a baseline data
summary for {{BASELINE_DATA}} 

```
tdtd
```


---

## `{{USER_NEEDS}}`

_Source: derived from the PTW collaboration document, via a conversation with
an LLM to build a structured user profile._

```
The user is a policy analyst at an international environmental NGO. They
are familiar with satellite-based monitoring concepts but are not a
remote-sensing specialist. They need to understand whether recent
deforestation activity indicates a meaningful escalation that warrants
internal escalation or engagement with government partners, rather than a
routine seasonal fluctuation.
```
