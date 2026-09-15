---
# ---- Required ----
title: "Agentic Multi-Step Geospatial Analysis"
type: benchmark
status: done

# ---- Recommended ----
created_at: 2026-07-23
updated_at: 2026-09-08

# ---- Classification ----
targets: capability
themes:
  - agents
  - geospatial
tags:
  - eudr
  - benchmark

# ---- Demo (when there's something to show) ----
demo:
  enabled: true
  type: sveltekit
  build_command: "pnpm build"
  output_dir: "demo/dist"
---

# Agentic Multi-Step Geospatial Analysis

> A benchmark and test of whether a coding agent can run an end-to-end EU Deforestation Regulation sourcing review over live cloud-native geodata. This experiment aims to evaluate the step-by-step trajectory of multi-step agentic workflows for a specified analytical task, and to characterize performance across models and conditions.


## Before

### What problem or question does this address?

We want to test capabilities against a real and known analytical workflow that involves a series of tasks and geospatial data interpretation. Examining EUDR compliance is a concrete, high-stakes instance of an analytical chain we can verify manually. Proving that a Brazilian soy or cattle portfolio was not deforested after 31 December 2020 means resolving property IDs against the national cadastre, matching field boundaries to those properties, classifying land cover, measuring post-2020 forest loss, and routing flagged properties to a cooperative or buyer who can act on it.

### What does this experiment actually do?

Runs 60 containerized sessions of the same 31-question EUDR workflow over a 117-property portfolio in Goiás, Brazil, changing one thing per run.

- **The workflow.** Six stages that depend on each other: find the data, resolve properties in the cadastre, match fields to properties, check for deforestation, route to buyers or cooperatives, and make the portfolio appraisal.
- **The data.** Three GeoParquet catalogs on Source Cooperative, read remotely: Trazo3 Goiás 2024 field boundaries, the Brazil CAR cadastre (8.4 million rows), and a commodity-infrastructure release.
- **The harness.** One Docker run per session, fresh workspace each time.
- **The grading.** A SQL oracle works out the correct answer for each question from the same data. A comparator grades every answer automatically.
- **Two arms.** Arm A gets the task plus four policy documents that specify the rules. Arm B gets only the questions, the input list, and the catalogs.
- **The scale.** Three models (Haiku 4.5, Sonnet 5, Opus 4.8) x two arms x 10 runs = 60 sessions.

### What signals are we looking for?

1. **Strict success.** At least one model gets all 31 questions right.
2. **Reliability.** For the best model, how many questions come out the same across all 10 runs.
3. **Error propagation.** Whether accuracy per stage looks different once you account for earlier mistakes. That shows where the policy documents and metadata are a real dependency.
4. **How much the spec matters.** The two arms are an A/B test on the value of adding rich context to the task.

### What are the boundaries?

- This checks the deforestation-free condition plus some legality indicators from the cadastre, as an experiment. It's evidence that could feed a compliance decision, not a compliance verdict.
- Not covered: dropping metadata, held-out catalogs, latency and throughput.

---

## Learnings

- Expertise, not model capability, is the bottleneck for agentic geospatial analysis. Strong models already have the spatial skills, and four short documents of written expert rules took them from 35% to 75% correct on a 31-question workflow.
- Write expert judgment down as plain policy documents the agent reads. In this benchmark it did more for accuracy than switching models, added no cost per run, and lets a domain expert change the rules without touching code.
- Costly agent errors make no noise. Across 60 sessions they produced no crashes or warnings, only plausible, well-formatted numbers that were wrong.
- Expert context and evaluation catch different errors, so an agentic workflow needs both. Documents corrected wrong judgment calls in every run. A coordinate-order slip that shrank every field by a third survived the documents, and only an independent answer key caught it.
- Agreement between runs isn't evidence of correctness. An agent can return the identical wrong answer ten times out of ten, so always score against something built independently of the agent.
- Judge agent errors by what they change downstream, not by how large they look. A near-miss distance can flip which organisation gets contacted, while a large-looking miss can be harmless formatting.
- Build the answer key before running the agent. Turning an existing expert workflow into checkable assertions with a stated output contract is what makes an agentic benchmark trustworthy, and the key carries over to the next workflow.
- Treat everything an agent reads as a possible answer leak. Numbers left in early instructions let an agent partly answer 5 of 31 questions without touching the data.

---

## After


### Signal check

- **Strict success.** **Refuted.** No session answered all 31 questions correctly. The best single run, Opus 4.8 with the policy documents, got 26. Five questions (q03, q14, q15, q19, q23) came out wrong in all 60 sessions.
- **Reliability.** **Confirmed.** Opus 4.8 with the documents gave the same grade on 28 of 31 questions across all 10 runs, and got 23 of those right every time. Sonnet 5 matched on 29 and got 21 right every time. Agreement isn't correctness. All 20 Sonnet and Opus runs with the documents report the same wrong matched-field area: 23,579 ha, where the answer key has 36,109 ha.
- **Error propagation.** **Confirmed.** Accuracy drops at the stage where a rule first applies and stays down for every question built on it. Without the documents, Sonnet and Opus score 100% on stage 2, 43% on stage 3, and 0% on stage 4. With them, Opus scores 10% on stage 6 across all runs but 100% on the runs where every upstream answer it depends on passed.
- **How much the spec matters.** **Confirmed.** The four documents take Sonnet 5 from 34.8% to 73.5% and Opus 4.8 from 34.8% to 75.2%. Cost barely moves: $4.53 per Opus session with them, $5.26 without. Haiku 4.5 stays near 12% either way, so the documents help only a model that can already do the spatial work.

### What happened?

We built the harness, generated the answer key by running the production `wri/rural-land` EUDR SQL against the same pinned catalogs, and ran all 60 sessions. The headline held: written expert context doubles accuracy for the two stronger models.

The saved answers show two different kinds of error, and they call for different fixes.

**Without the documents, the agent makes defensible calls that aren't the expert's.** All 20 Sonnet and Opus runs decided MapBiomas class 21 (Mosaic of Uses) is no Annex I commodity. The policy counts it as cattle. That one call removes 24.4 of 67.9 ha of post-2020 cattle clearing and drops a flagged property off the non-compliant list. The same runs ranked the nearest slaughterhouse ahead of the farm's cooperative as the first contact for 13 to 17 of the 17 or 18 properties each run flagged. The answer key ranks the cooperative first for 16 of 18. Each of these changes what a trader would do. The documents fixed both, in every run.

**With the documents, most remaining misses trace to one technical slip.** DuckDB's spatial functions read GeoParquet coordinates latitude-first unless you set `geometry_always_xy = true`. Without that setting, every field comes out 35% too small, with no error and a plausible number. The slip appears in all 20 Sonnet and Opus runs with the documents and 18 of 20 without. It also shortens distances, which pushes two properties across the 10 km proximity rule and changes their first contact. The grader scored those two swapped flags as a near miss.

Two smaller surprises. Answers can pass on tolerance and still carry error downstream. Without the documents, runs matched 798 fields where the key has 793, which passes. Those extra fields then move later loss totals by up to 5%. And early drafts of the policy documents leaked answers: five of 31 questions were partly answerable from the documents before any query ran.

### What would you recommend?

- **Share it.** The results make a concrete, defensible case for agentic geospatial workflows with written expert context, and the saved transcripts let anyone check the claims.
- **Adopt the pattern:** write the expert rules of a workflow down as policy documents before handing it to an agent. It doubled accuracy here at no extra cost.
- **Keep a graded eval in the loop for anything that ships.** Documents can't prevent slips nobody anticipated, like axis order. Only the answer key caught it.
- **Give decision-changing fields no near-miss credit.** A swapped threshold flag or contact tier is a wrong answer.
- **Don't run this unattended as a compliance tool yet.** The best run got 26 of 31, and the misses include hectare totals a report would quote.
- **Build on it** with the next two workflows already designed, agricultural drought and self-hosted forest monitoring, reusing this harness and oracle approach.
- **Skip Haiku 4.5** for multi-step spatial work of this kind.

### What decisions and tradeoffs came up along the way?

- **Production SQL as the answer key, not hand-built answers.** The key regenerates with checksums and matches what real reports use. The tradeoff: it inherits the pipeline's judgment calls, such as treating Mosaic of Uses as pasture and excluding forest plantation because detection is unreliable.
- **Stripped measured figures out of the policy documents.** Five questions were partly answerable from the documents alone. Every calibration number moved into the methods note, and a test now fails if any golden value appears in a mounted file.
- **No area or projection convention in the documents, on purpose.** Stating one would have raised scores and hidden the axis-order slip, which is the most transferable finding.
- **A 1% tolerance for geometry questions.** Reasonable area methods land within 1% of each other, so the tolerance lets the agent pick one. One exception grades strict (q23), because the slack credited answers naming a neighbouring field ID.
- **Case-insensitive string grading.** Capitalization alone cost an ablation arm 23 to 28 points on runs that classified every crop identically.
- **A measured tie tolerance for assigning fields to properties.** Area methods disagree by about 1e-11 on containment fractions, enough to hand a field to a different property. The tie band sits at 1e-9, between that noise and the closest real difference.
- **A near-miss category at ten times the tolerance.** It separates formatting and rounding from real errors, but it also labeled two decision-changing flag swaps as near misses. Worth revisiting.
- **A damaged input list.** Stage 2 seeds duplicates, a centroid-only row, an ID-less polygon, swapped axes, and an unresolvable point, so faithful input handling gets graded and not assumed.
- **Isolated sessions.** Each run starts from an empty home directory in Docker, so no host configuration, hooks, or memory reach the agent.
- **Keep the run artifacts in the repo.** Claude Code's 30-day cleanup deleted the interactive transcripts from July and August. The per-run `transcript.jsonl` files, answers, and grades are the durable record.
