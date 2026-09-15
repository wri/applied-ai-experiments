# Methods: an EUDR workflow benchmark for language models

## The question and why it matters

The EU Deforestation Regulation requires operators to show that commodities placed on the EU market come from land not deforested after 31 December 2020. For a Brazilian soy or cattle portfolio, proving this requires resolving property IDs against the national cadastre, matching fields to those properties, classifying land cover, measuring forest loss, and routing flagged properties to cooperatives or buyers that can act. This is spatial work at scale—tedious, error-prone, and exactly the kind of task language models might handle well. The question is whether they can reliably execute it against real cloud-native data and what it costs.

We test three models on a 117-property Goiás portfolio. The agent receives four policy documents and 31 questions organized into six interdependent stages. It queries three remote GeoParquet catalogs over HTTP range requests, recovers from its own SQL errors, and writes a CSV per question plus a final decision artifact. A SQL oracle produces the answer key. An executable comparator grades the results.

Two repositories hold the work. [`wri/rural-land`](https://github.com/wri/rural-land) contains the production EUDR pipeline and its SQL. `geodata-llm-eval` contains the benchmark and pins the SQL at a specific commit so the answer key uses the same queries that generate reports.

## Execution

Three models run the benchmark: Claude Haiku 4.5, Sonnet 5, and Opus 4.8. Ten independent sessions per model using default temperature yield 30 total passes. Each session is one `docker run` of a pinned image against a fresh workspace carrying Claude Code CLI 2.1.218 and DuckDB 1.3.2 with `spatial` and `httpfs` extensions.

Sessions run as a non-root user with an empty HOME so no host `CLAUDE.md`, hook, MCP server, or memory file reaches them. They use three remote catalogs on [Source Cooperative](https://source.coop):

| Layer | Source | Version |
|---|---|---|
| Field boundaries | `wri-data-lab/trazofields`, Trazo3 Goiás 2024 | collection `trazo3-fields` |
| Cadastral parcels | `tristangruppwri/cadastral`, Brazil CAR, 8.45M rows | snapshot 2026-07-16 |
| Commodity infrastructure | `tristangruppwri/soft-commodity-infrastructure`, `BR_facilities` | release 2026-07-23 |

Every session commits its full `transcript.jsonl`, its `answers/`, and a `meta.json` carrying token counts and exit code. Anyone can re-grade the transcripts without model calls.

A SQL oracle generates ground truth by running the committed `rural-land` SQL against the same pinned catalogs. Trazo3 fields include a MapBiomas 2024 mode class and five Hansen-derived columns of cleared area. Post-2020 loss comes from Hansen. All queries use one consistent loss definition. The pins live in `fixtures/pins.json` alongside the `rural-land` commit (`42f6837`) and the DuckDB version used for the answer key (1.5.5).

## Workflow stages

The 31 questions form six stages. Each stage builds on the previous one and tracks how a supply-chain analyst moves through a portfolio.

**Stage 1: catalog discovery (q01-q04).** Navigate three catalogs from metadata alone. Count STAC collections, read the recommended collection from the catalog description, report row counts and geometry EPSG.

**Stage 2: cadastre resolution (q05-q07, q31).** Resolve the listed `cod_imovel` values against the 8.45M-row CAR file. Report what resolves, what goes missing, what appears twice, and how many parcels fall under one hectare. The list arrives damaged: it carries a duplicated row, a parcel reduced to its centroid, a polygon with no id, a polygon with its coordinate axes swapped, and a point that lands on no parcel at all. `INPUTS.md` states the handling for each, and q31 grades the reconciliation identity that ties the buckets back to the arrival count. Handled correctly every defect resolves to a parcel that was already on the list, so the portfolio downstream is unchanged and a mishandled defect cascades visibly.

**Stage 3: field to cadastre matching (q08-q14).** Implement the matching rule from `MATCHING.md`. A field enters the analysis when two-thirds of its area falls inside a single listed parcel, or when two-thirds falls inside the buffered union of all listed parcels. The 25 m buffer closes sliver gaps between neighbouring CAR parcels. Report how many fields each rule admitted, the containment-fraction bounds, and the fields that intersect a parcel but fail both tests.

**Stage 4: EUDR deforestation (q15-q23).** Classify every MapBiomas class present according to `EUDR_CROPS.md`, then measure post-2020 loss on in-scope ones. The scope table distinguishes classes the regulation omits (sugarcane) from classes the sensor cannot see reliably (planted timber). Report the out-of-scope breakdown separately so exclusions stay auditable.

**Stage 5: commodity infrastructure (q24-q29).** Route each flagged property according to `COOPS.md`. Every cadastral parcel receives a ranked set of candidates from five tiers: municipality-level cooperative membership, grain intake points, slaughter points, mill points, and modeled gravity catchments. The dominant crop determines which tiers survive. Distances run in EPSG:5880 from cadastral centroid to facility point. When fewer than two candidates sit inside 100 km, widen the radius toward a 300 km ceiling and flag the result as `widened`.

**Stage 6: portfolio decision (q30).** For every property non-compliant on an in-scope crop, report its top-ranked contact with tier, basis, and distance.

Each question declares its dependencies so the grader can separate answers wrong on their own merits from those wrong because upstream answers failed.

## Policy as specification

The four documents in `policies/` define the specification. They state the 2/3 containment threshold, the 25 m buffer, the EPSG:5880 distance rule, and the Annex I commodity mapping. The task is the spatial work of applying them across a live portfolio.

`EUDR_CROPS.md` defines crop scope. The agent must read this policy and carry its caveats through nine downstream questions. This mirrors the real job, where a compliance rule arrives as a document and the analyst implements it.

`INPUTS.md` governs the input list and forbids silent drops. An omitted property is an unaudited sourcing area—the exact failure the workflow exists to prevent. The reconciliation identity must hold:

```
resolved_clean + centroid_resolved + geometry_resolved
  + duplicates_removed + unresolvable = input_rows
```

### Calibration figures stay out of the mounted documents

A policy states its rule and the reasoning behind it. It must not state a number the session is asked to compute. The mounted documents are the one thing a session reads before it queries anything, so a measured aside is an answer key.

Four such asides were removed. `MATCHING.md` justified the duplicate-id edge case by noting that CAR ships 8,453,554 rows under 8,437,940 distinct ids, which is both columns of `q03`, and added that the sample list contains no duplicate id because `q07` reports 0. Its tie-rule section observed that 54 of the 793 matched fields tie exactly, and 793 is `q09`. `COOPS.md` justified the widening rule by naming Jussara, the município holding most of the Goiás list and therefore part of `q06` and `q20`, and pointed at "the value q26 reports". Five of thirty-one questions were partly answerable without touching data.

The rules and their rationale stay in the policies; the figures live here, where no session can read them.

`tests/test_no_leaks.py` enforces this. It reads every cell of every golden fixture and searches the mounted set — `prompts/task.md`, `fixtures/questions.yaml`, `policies/` — for each value, in plain and thousands-separated form. Controlled vocabulary is exempt, since a policy that defines `intake_point` or names the MapBiomas class `Pasture` is stating its own terms rather than an answer: labels are recognised as lowercase snake_case, and class names are read out of the `EUDR_CROPS.md` scope table rather than duplicated in the test. Policy constants (`0.667`, `25`, `1e-9`, EPSG codes) and Hansen era labels are allowlisted for the same reason. A second test forbids a policy from naming a question id at all, which is the blunter version of the same failure.

## The oracle

`oracle/render.py` generates golden answers. It runs the `rural-land` EUDR SQL, vendored under `oracle/sql/` at the pinned commit, against the same pinned remote catalogs. The pipeline runs in dependency order, with each stage reading the parquet the previous stage wrote:

```
eudr_crops → cad_extract → fields_extract → match → coop_match
```

Thirty query templates render against those extracts and emit `fixtures/golden/qNN.csv` with a `SHA256SUMS` manifest. Each expert answer comes from a committed, re-runnable query with a stated derivation. Anyone can regenerate the key and diff the checksums.

## Cost and grading

The harness logs token counts and imputes dollars at list API prices, pricing input, output, and cache tokens separately. Prompt caching applies identically to all models. Sonnet 5 has an introductory price of $2/$10 through 2026-08-31; the benchmark uses list price for post-promotion comparability. The headline figure is a Pareto plot with accuracy on the y-axis against imputed dollars on the x-axis.

An executable comparator grades each session's answers against the golden files. Rows compare as multisets and column order does not matter. Floats match within relative 1e-3 except geometry questions, which use 1e-2. Strings match apart from case. A missing or unparseable file records as its own outcome, distinct from a wrong answer. This keeps broken sessions separable from wrong ones.

Case folding matters more for the ablation arms than for the model comparison. A controlled vocabulary written down in one policy document is unrecoverable once that document is withheld, and `annex1_commodity` is reported by seven questions across stages 4 through 6. Grading its capitalization made the `no-crops` arm score 23, 28, and 23 on runs that had classified every crop identically. Folding case leaves the arm measuring what it is for: whether a model can determine EUDR scope and routing without being told. The residual failure on q16's `caveat` tokens is that measurement working, since those tokens are policy content rather than formatting.

The harness reports raw accuracy (correct over all questions in a stage) and conditional accuracy (correct over questions whose every dependency graded correct). The gap signals error propagation. High raw with low conditional means the LLM fails that stage. High conditional with low raw means upstream mistakes dominate.

## Consistency across runs

Each session writes `answers/workflow.csv` with one row per property flagged non-compliant. `harness/consistency.py` measures agreement across the ten runs of a model using Jaccard similarity on the flagged set, Kendall tau-b on the post-2020 loss ranking, and Fleiss kappa on the choice of top contact.

The flagged set is agent-determined since it inherits the stage-4 scope classification. Set-level agreement measures whether runs agree on who falls in scope at all. Every metric is also computed against the oracle. Ten runs can agree perfectly and all be wrong, so the report shows `consistency@10` beside `accuracy@10`.

## Experiment 2: input robustness

Experiment 1 measures whether a model can run the workflow on a clean 117-property Goiás portfolio. Experiment 2 holds the workflow fixed and feeds a deliberately malformed Mato Grosso soy portfolio to measure whether the model applies `INPUTS.md` faithfully.

The portfolio draws real soy properties carrying post-2020 loss from five frontier municipalities (Alta Floresta, Juara, Nova Canaã do Norte, Tabaporã, Itaúba). It seeds four defect kinds: duplicate IDs and geometries (deduped on id+geometry), IDs with point geometry (resolved by ID, point precision flagged), polygons without IDs (resolved by containment against CAR), and points without IDs (matched point-in-parcel, unresolvable if zero or multiple matches).

The same portfolio ships in three encodings selected with `run.py --input-mode`: a CSV of IDs, a geometry parquet including ID-less rows, and a split pair joined on the ID. `build_inputs.py` generates all of them from the live catalogs and writes `manifest.json` with each row's origin cadastre, defect kind, and expected resolution. The manifest is the experiment's answer key and never enters a session. Selection, region, and defect counts live in `config.json`, so changing to a new municipality or commodity is a config change.

The deterministic build ensures the same config and seed produce byte-identical inputs.

## Scope limits

Metadata dropout, latency measurement, and held-out catalogs stay out of this design.

Coffee and oil palm have no delivery infrastructure in the current facilities product. The benchmark grades reporting that gap as correct and inventing a route as wrong.

`EUDR_CROPS.md` excludes forest plantation on detection grounds despite its Annex I status. It treats MapBiomas class 21 (mosaic of uses) as pasture. Both assumptions appear in the policy and carry into the answers as caveats, so readers see where the analysis rests on judgment calls.

EUDR compliance is cumulative. A commodity qualifies when it is deforestation-free and legal and covered by a due diligence statement. This workflow measures the deforestation-free condition and supplies CAR-based legality indicators. It is an evidence tool feeding a compliance decision made elsewhere.