# Agentic Multi-Step Geospatial Analysis

> See [brief.md](./brief.md) for context, signals, learnings, and findings.

Can a coding agent run a six-stage EU Deforestation Regulation (EUDR) sourcing review over live
cloud-native geodata, and does written expert context help? Three Claude models ran the same
31-question workflow ten times each, with and without four policy documents: 60 sessions over a
117-property portfolio in Goiás, Brazil.

| Model | With the policy documents | Without |
|---|---|---|
| Haiku 4.5 | 11.9% | 11.3% |
| Sonnet 5 | 73.5% | 34.8% |
| Opus 4.8 | 75.2% | 34.8% |

Mean share of 31 questions graded correct, ten runs per cell.

## How we verify the answers

Nobody judges the agent's output by eye, and no model grades it. The grader checks every answer
against a key computed independently from the same data, before any session runs.

**The answer key comes from production code, not hand-written answers.** A SQL oracle
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
`fixtures/`, `policies/` and `prompts/` at the root. Early drafts of the documents did leak
figures that made 5 of 31 questions partly answerable, and we removed them.

**Every run starts clean and keeps a full record.** Each session is one Docker run in a fresh workspace with
an empty home directory, so no host configuration reaches the agent. Every session keeps its full
transcript, its answers, its per-question grades, and a per-cell diff against the key.

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
└── results/
    ├── with-spec/              # policy documents mounted
    └── no-spec/                # policy documents withheld
        ├── summary.csv         # one row per run: accuracy, cost, turns, wall clock
        ├── report.md           # per-model and per-stage tables
        ├── pareto.png          # cost against accuracy
        └── <model>/<run>/      # transcript.jsonl.gz, answers/, grades.json, diffs.json, meta.json
```

## Source repositories

- Harness and benchmark: [nlebovits/geodata-llm-eval](https://github.com/nlebovits/geodata-llm-eval),
  and the fork the runs used, [tristangrupp/geodata-llm-eval-simple](https://github.com/tristangrupp/geodata-llm-eval-simple).
  The run results here aren't in either repository.
- The oracle SQL comes from WRI's internal EUDR pipeline repository, which isn't public. The copy
  under `methods/oracle/sql/` is the version that produced the answer key.

## Data

Three catalogs on [Source Cooperative](https://source.coop), read remotely over HTTP range
requests and pinned in `data/fixtures/pins.json`:

| Layer | Source |
|---|---|
| Field boundaries | `wri-data-lab/trazofields`, Trazo3 Goiás 2024 |
| Cadastral parcels | `tristangruppwri/cadastral`, Brazil CAR, 8.45M rows |
| Commodity infrastructure | `tristangruppwri/soft-commodity-infrastructure`, `BR_facilities` |

Rerunning sessions needs Docker, an Anthropic API key, and the harness repository. See
`methods/README-repo.md`.
