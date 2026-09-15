# EUDR workflow benchmark results

Accuracy is the share of questions graded correct against the
golden fixture. Cost is imputed from logged tokens at list API
prices (see harness/pricing.py).

Near misses clear ten times the grading tolerance but not the
tolerance itself: computed right, formatted or rounded differently.

| Model | Passes | Mean accuracy | Accuracy range | Mean near misses | Mean cost (USD) |
|-------|--------|---------------|----------------|------------------|-----------------|
| Haiku 4.5 | 10 | 11.3% | 9.7% – 12.9% | 4.8 | $0.7007 |
| Sonnet 5 | 10 | 34.8% | 32.3% – 35.5% | 4.5 | $5.7583 |
| Opus 4.8 | 10 | 34.8% | 32.3% – 35.5% | 4.5 | $5.2559 |

## Runtime

Slow-call share is time inside tool calls slow enough to emit a
heartbeat, over wall clock. A high share with timeouts means the
run was degraded by the network, not by the model.

| Model | Mean wall clock | In slow tool calls | Timed-out calls |
|-------|-----------------|--------------------|-----------------|
| Haiku 4.5 | 7m | 2% | 0 |
| Sonnet 5 | 16m | 4% | 0 |
| Opus 4.8 | 20m | 7% | 3 |

## Accuracy by workflow stage

Raw = correct / all in stage. Cond. = correct / questions whose
dependencies all passed (the error-propagation-adjusted score).

| Model | S1 | S2 | S3 | S4 | S5 | S6 |
|-------|-----|-----|-----|-----|-----|-----|
| Haiku 4.5 | 72%/72% | 15%/15% | 0%/0% | 0%/– | 0%/– | 0%/– |
| Sonnet 5 | 75%/75% | 100%/100% | 43%/43% | 0%/0% | 13%/– | 0%/– |
| Opus 4.8 | 75%/75% | 100%/100% | 43%/43% | 0%/0% | 13%/– | 0%/– |
