# Agentic Multi-Step Geospatial Analysis

> See [brief.md](./brief.md) for context, signals, learnings, and findings.

Can a coding agent run a six-stage EU Deforestation Regulation (EUDR) sourcing review over live
cloud-native geodata, and how much does written expert context change the result? Three Claude
models ran the same 31-question workflow ten times each over a 117-property portfolio in Goiás,
Brazil. A separate one-shot run turned the same workflow into a published report.

## Results

Forty runs, September 2026. Accuracy is the share of 31 questions graded correct against an SQL
answer key. Every run in the table carries the same key fingerprint, so the scores compare.

| Cohort | Model | Spec | Mean accuracy | Range | Mean cost |
|---|---|---|---|---|---|
| Sonnet, spec | `claude-sonnet-5` | full | 92.6% | 87.1 to 96.8% | $5.89 |
| Opus, spec | `claude-opus-4-8` | full | 90.6% | 87.1 to 96.8% | $4.49 |
| Opus, no spec | `claude-opus-4-8` | questions only | 28.4% | 12.9 to 41.9% | $3.55 |
| Haiku, spec | `claude-haiku-4-5` | full | 9.0% | 0 to 19.4% | $0.69 |

The expert specification is what moves the two strong models. Opus goes from 28.4% without it to
90.6% with it. Haiku fails either way, so the spec only helps a model that can already do the
spatial work. No run in any cohort answered all 31 questions correctly.

Accuracy by the rule each question depends on shows where the spec earns its keep:

| Rule the question needs | Questions | Haiku, spec | Opus, no spec | Opus, spec | Sonnet, spec |
|---|---|---|---|---|---|
| None: catalogue, schema, extent | 4 | 53% | 100% | 100% | 100% |
| Parcel resolution | 5 | 8% | 68% | 100% | 98% |
| Field matching | 8 | 0% | 12% | 91% | 95% |
| Scope table and era bands | 7 | 4% | 0% | 80% | 86% |
| Facility routing | 7 | 3% | 6% | 91% | 91% |

Questions that need no expert rule come out perfect without the spec. Everything resting on a
written rule collapses without it. The failures trace to missing expert context rather than weak
geospatial reasoning.

Five of the ten no-spec Opus runs stopped early rather than invent the missing rules. One said so
plainly:

> Inventing thresholds and MapBiomas to commodity mappings would give you 27 graded CSVs that look
> complete and are wrong. That's worse than an honest gap.

Every number in these tables recomputes from `results/benchmark-2026-09/`, which holds one row per run, one
row per run and question, and one row per graded cell that differed from the key. Its own README
documents the cohort definitions, the hand-assigned section map, and a grader artifact that
excludes 8 of 1,240 question instances.

## The one-shot demo

A second run tested the other end of the range: one agent, one spec, one pass, a real deliverable.
A Codex CLI session read a single `SPEC.md` and the same three catalogs, then wrote a Quarto report
with an interactive table and a field-level map.

- Report: <https://tristangrupp.github.io/cng-nyc-evals-demo/>
- Code, spec, and session transcript: <https://github.com/tristangrupp/cng-nyc-evals-demo>

The demo never saw the benchmark's answer key. It agrees with it anyway:

```
$ python scripts/check_demo_against_key.py <demo>/property_results.csv
flagged properties: key 18, demo 18, identical set: True
post-2020 loss on flagged land: key 114.7 ha, demo 114.8 ha
per-property loss differing by more than 0.05 ha: 0
properties given a different top contact: 0
```

Same 18 properties, same contact for each, same hectares. That's the benchmark's last question,
q30, answered independently and in a form someone could act on.

## How verification works

Nobody judges the agent's output by eye, and no model grades it. The grader checks every answer
against a key computed independently from the same data, before any session runs.

**The answer key comes from production code, not hand-written answers.** An SQL oracle
(`methods/oracle/render.py`) runs the queries behind WRI's own EUDR reporting pipeline, vendored
here at a pinned commit, against the same pinned catalog versions the agent reads. It writes one
CSV per question to `data/fixtures/golden/` with a SHA256 manifest, so anyone can regenerate the
key and diff the checksums.

**Each question is an assertion with a written output contract.** `data/fixtures/questions.yaml`
states each question, the columns the answer must carry (by meaning and type), and the row count
where it's fixed. The agent chooses its own column names and row order. The grader matches
columns by trying permutations and compares rows as sets, so a correct answer in a different
layout still passes.

**Written tolerances decide what passes.**

- Integers must match exactly. Text matches without regard to case.
- Numbers match within 0.1%.
- Questions whose value depends on a reasonable choice of area or distance method match within
  1%, the spread between equal-area, geodesic, and Brazil Polyconic calculations.
- One ranking question has no tolerance, because slack would credit a neighbouring field ID.
- A missing or unreadable answer file is its own outcome, apart from a wrong answer.
- The report counts near misses, inside ten times the tolerance, apart from wrong answers.

**Dependencies separate a wrong answer from an inherited one.** Each question lists the earlier
questions it builds on. The report gives raw accuracy per stage and conditional accuracy, counting
only questions whose dependencies all passed, so a stage-3 mistake doesn't count against stage 6
twice.

**The agent can't see the answers.** Golden files never enter a session. A test,
`methods/tests/test_no_leaks.py`, fails if any golden value appears in the task prompt, the
question file, or the policy documents. It expects the harness repository's layout, with
`fixtures/`, `policies/` and `prompts/` at the root.

**Every run starts clean and keeps a full record.** Each session is one Docker run in a fresh
workspace with an empty home directory, so no host configuration reaches the agent. Every session
keeps its full transcript, its answers, its per-question grades, and a per-cell diff against the
key. Each run also records the fingerprint of the key, the spec, and the pinned data it read.

**Agreement and correctness get their own scores.** `consistency.json` scores how much a model's
ten runs agree with each other, and how much they agree with the key. Ten runs can agree on every
answer and all be wrong, and here they sometimes did.

## Regrading without model calls

The committed answers regrade offline in seconds, with no API key:

```bash
python methods/harness/grade.py \
  --results results/with-spec \
  --golden data/fixtures/golden \
  --questions data/fixtures/questions.yaml
```

This rewrites each run's `grades.json` in place and prints a per-run summary. It reproduces the
committed grades exactly. Python 3.10 or later.

The folder keeps transcripts gzipped. To read one:

```bash
gunzip -c results/with-spec/opus/20260803T155110Z-a1e97f8/transcript.jsonl.gz | head
```

## What's in here

```
├── brief.md                    # context, signals, learnings, and close-out
├── data/
│   ├── fixtures/
│   │   ├── questions.yaml      # the 31 questions, stages, dependencies, output contracts
│   │   ├── golden/             # the answer key: one CSV per question, SHA256SUMS
│   │   ├── lists/              # the 117-property Goiás portfolio (CSV and GeoParquet)
│   │   └── pins.json           # catalog versions, pipeline commit, DuckDB version
│   ├── policies/               # INPUTS.md, MATCHING.md, EUDR_CROPS.md, COOPS.md
│   └── prompts/task.md         # framing given to the arm with documents
├── methods/
│   ├── METHODS.md              # the methods note
│   ├── README-repo.md          # the harness repository's README
│   ├── harness/                # run, grade, consistency, report, and pricing code
│   ├── oracle/                 # the SQL that renders the answer key
│   ├── tests/test_no_leaks.py  # fails if a golden value appears in anything a session reads
│   └── Dockerfile, pixi.toml, pixi.lock
├── results/
│   ├── benchmark-2026-09/      # the 40-run result set behind the tables above
│   ├── with-spec/              # earlier 60-session sweep, policy documents mounted
│   └── no-spec/                # the same sweep with the documents withheld
└── scripts/
    └── check_demo_against_key.py   # compares the one-shot demo with the key
```

`with-spec/` and `no-spec/` hold an earlier August sweep against an older spec and grader. Those
runs scored 73.5% (Sonnet) and 75.2% (Opus) with the documents, against 34.8% without. Read them
as the per-run archive, and read `benchmark-2026-09/` for current numbers.

## Source repositories

- Benchmark and harness: [nlebovits/geodata-llm-eval](https://github.com/nlebovits/geodata-llm-eval).
  It now carries the ablation harness behind the `questions-only` arm, adapters for agents beyond
  Claude, and strict-task-success reporting.
- One-shot demo: [tristangrupp/cng-nyc-evals-demo](https://github.com/tristangrupp/cng-nyc-evals-demo).
- The oracle SQL comes from WRI's internal EUDR pipeline repository, which isn't public. The copy
  under `methods/oracle/sql/` is the version that produced the answer key.

## Data

Three catalogs on [Source Cooperative](https://source.coop), read remotely over HTTP range
requests and pinned in `data/fixtures/pins.json`. Each ships as GeoParquet, with metadata written
to the Portolan specification. That metadata is what lets an agent find the right collection and
read its schema without a path handed to it.

| Layer | Source |
|---|---|
| Field boundaries | `wri-data-lab/trazofields`, Trazo3 Goiás 2024 |
| Cadastral parcels | `tristangruppwri/cadastral`, Brazil CAR, 8.45M rows |
| Commodity infrastructure | `tristangruppwri/soft-commodity-infrastructure`, `BR_facilities` |

Rerunning sessions needs Docker, an Anthropic API key, and the harness repository. See
`methods/README-repo.md`.
