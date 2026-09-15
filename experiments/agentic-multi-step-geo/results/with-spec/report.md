# EUDR workflow benchmark results

Accuracy is the share of questions graded correct against the
golden fixture. Cost is imputed from logged tokens at list API
prices (see harness/pricing.py).

Near misses clear ten times the grading tolerance but not the
tolerance itself: computed right, formatted or rounded differently.

| Model | Passes | Mean accuracy | Accuracy range | Mean near misses | Mean cost (USD) |
|-------|--------|---------------|----------------|------------------|-----------------|
| Haiku 4.5 | 10 | 11.9% | 6.5% – 16.1% | 5.1 | $0.7874 |
| Sonnet 5 | 10 | 73.5% | 71.0% – 74.2% | 2.0 | $6.2353 |
| Opus 4.8 | 10 | 75.2% | 74.2% – 83.9% | 1.9 | $4.5294 |

## Runtime

Slow-call share is time inside tool calls slow enough to emit a
heartbeat, over wall clock. A high share with timeouts means the
run was degraded by the network, not by the model.

| Model | Mean wall clock | In slow tool calls | Timed-out calls |
|-------|-----------------|--------------------|-----------------|
| Haiku 4.5 | 9m | 15% | 1 |
| Sonnet 5 | 16m | 1% | 0 |
| Opus 4.8 | 16m | 0% | 0 |

## Accuracy by workflow stage

Raw = correct / all in stage. Cond. = correct / questions whose
dependencies all passed (the error-propagation-adjusted score).

| Model | S1 | S2 | S3 | S4 | S5 | S6 |
|-------|-----|-----|-----|-----|-----|-----|
| Haiku 4.5 | 62%/62% | 22%/25% | 1%/0% | 0%/– | 3%/– | 0%/– |
| Sonnet 5 | 72%/72% | 100%/100% | 86%/86% | 67%/67% | 65%/67% | 0%/– |
| Opus 4.8 | 75%/75% | 100%/100% | 86%/86% | 67%/67% | 70%/70% | 10%/100% |

## Cross-run consistency

Agreement across 10 runs of the workflow artifact. Consistency is
not correctness: the oracle column is the reality check.

| Metric | Across runs | vs oracle |
|--------|-------------|-----------|
| Flagged-set Jaccard | 1.000 | 1.000 |
| Contact agreement | 0.989 | 0.900 |
| Ranking tau-b | 1.000 | – |
| Contact kappa | 0.925 | – |
