# Success by capability: the data behind the chart

This bundle holds every number in the grouped bar chart `success_by_capability.png`, plus the two judgment calls that shape it. Recompute the chart from `question_instances.csv` alone.

## Files

| File | Rows | What it holds |
| --- | --- | --- |
| `question_instances.csv` | 1240 | One row per run and question. Every bar comes from this file. |
| `cells.csv` | 1908 | One row per graded cell that differed from the golden answer. |
| `runs.csv` | 40 | One row per run. Cost, duration, turns, token counts, fingerprints. |
| `make_export.py` | n/a | The script that wrote the three CSVs. |

## How to rebuild a bar

```python
import pandas as pd
d = pd.read_csv('question_instances.csv')
kept = d[d.excluded_grader_artifact == 0]
rate = (kept.groupby(['cohort', 'spec_section'])
            .is_correct.mean() * 100)
```

Excluded rows are never graded `correct`, so `d.groupby(...).is_correct.mean()` on the full frame gives the rate without the exclusion. Compare the two to see how little the exclusion moves.

## Cohorts

| Cohort | Model ID | Arm | Runs |
| --- | --- | --- | --- |
| Haiku, spec | claude-haiku-4-5 | full | 10 |
| Opus, no spec | claude-opus-4-8 | questions-only | 10 |
| Opus, spec | claude-opus-4-8 | full | 10 |
| Sonnet, spec | claude-sonnet-5 | full | 10 |

The `full` arm gives the agent the whole of SPEC.md. The `questions-only` arm keeps sections 1, 3 and 9 and removes sections 2 and 4 through 8. Section 8 is the worked example. The agent still sees all 31 questions.

Four questions name a cut section by number. Those are q05, q23, q31 and the note on `workflow.csv`. The dangling reference is part of the condition. Sections 1 and 3 stay because without them no session can find the data or name an answer file, which would measure the harness rather than the spec.

The run store holds more runs than these 40. Each cohort takes the first 10 runs in directory order after filtering on the arm. `Opus, no spec` also keeps runs with status `incomplete`, because 5 of those runs stopped on purpose rather than guess. Dropping them would hide the finding.

## The section map

`spec_section` is assigned by hand, not recorded by the harness. Each question is filed under the section of SPEC.md it cannot be answered without. The source is the question's own text and its `depends_on` chain in `fixtures/questions.yaml`. Disagree with a row and you can regroup the CSV yourself.

| Section | Questions |
| --- | --- |
| No expert rule needed: catalogue, schema, extent | q01, q02, q03, q04 |
| Parcel resolution: SPEC.md section 4 | q05, q06, q07, q08, q31 |
| Field matching: SPEC.md section 5 | q09, q10, q11, q12, q13, q14, q15, q22 |
| Scope table and era bands: SPEC.md section 6 | q16, q17, q18, q19, q20, q21, q23 |
| Facility routing: SPEC.md section 7 | q24, q25, q26, q27, q28, q29, q30 |

## The grader-artifact exclusion

`excluded_grader_artifact` marks a failure the grader caused. The harness compares two integers exactly at `harness/grade.py:363`, while a float of the same size gets a relative tolerance of 1e-3. A count that misses by 2 in 3,291 therefore fails, and the same value as a float would pass. The rule also forgives a string that names what the golden names in another word, such as `covered` against `yes`.

The rule excludes 8 question-instances out of 1240. Check each one in `cells.csv`. A failure qualifies only when every one of its cells qualifies, so a count that misses by thousands stays in the denominator.

## Success rate, the chart in numbers

| Rule the question needs | Questions | Haiku, spec | Opus, no spec | Opus, spec | Sonnet, spec |
| --- | --- | --- | --- | --- | --- |
| No expert rule needed: catalogue, schema, extent | 4 | 53% | 100% | 100% | 100% |
| Parcel resolution: SPEC.md section 4 | 5 | 8% | 68% | 100% | 98% |
| Field matching: SPEC.md section 5 | 8 | 0% | 12% | 91% | 95% |
| Scope table and era bands: SPEC.md section 6 | 7 | 4% | 0% | 80% | 86% |
| Facility routing: SPEC.md section 7 | 7 | 3% | 6% | 91% | 91% |
| All | 31 | 9% | 28% | 91% | 93% |

## Grade vocabulary

- `correct`: every cell matched inside tolerance.
- `near_miss`: passed at a tolerance 10 times looser than the one the grade uses. Counted as a failure.
- `wrong`: the answer file parsed and disagreed.
- `missing`: the agent never wrote the answer file.
- `unparseable`: the file existed and would not parse.

## Fingerprints

- Golden answers: 7bbdf1bbf735
- SPEC.md: 793d5d7d8c65, ae79010ed785
- Pinned data assets: df23891ca73b

The golden fingerprint is the same across all 40 runs. Scores are therefore comparable. The spec fingerprint differs between the two arms by design, because the ablation removes sections.

## Known limits

- The section map is a judgment call. It is listed above so you can check it.
- 10 runs per cohort. Run-to-run spread is wide for the weaker cohorts. See `accuracy_pct` in `runs.csv`.
- `imputed_cost_usd` is computed from token counts at list prices. It is not a billed figure.
- The grader is stricter than the spec in places. The exclusion rule above catches the integer case. Other failures trace to sections of SPEC.md that state a decision without fixing the output format.
