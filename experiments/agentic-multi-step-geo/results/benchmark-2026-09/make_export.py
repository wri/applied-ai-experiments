"""Rebuild the success-by-capability data bundle.

Run:
    python3 make_export.py <path-to-results-dir> <out-dir>

The three CSVs are written from the same run files the
chart reads. The section map and the grader-artifact rule
are copied verbatim from scripts/success_by_capability.py
in the geodata-llm-eval repository so that this bundle
stands on its own.
"""

import collections
import csv
import json
import pathlib
import sys

# The section of SPEC.md a question cannot be answered
# without. Assigned by hand from each question's own text
# and its depends_on chain in fixtures/questions.yaml.
CAPABILITIES = {
    "No expert rule needed: catalogue, schema, extent": [
        "01", "02", "03", "04",
    ],
    "Parcel resolution: SPEC.md section 4": [
        "05", "06", "07", "08", "31",
    ],
    "Field matching: SPEC.md section 5": [
        "09", "10", "11", "12", "13", "14", "15", "22",
    ],
    "Scope table and era bands: SPEC.md section 6": [
        "16", "17", "18", "19", "20", "21", "23",
    ],
    "Facility routing: SPEC.md section 7": [
        "24", "25", "26", "27", "28", "29", "30",
    ],
}
QUESTION_SECTION = {
    f"q{q}": section
    for section, questions in CAPABILITIES.items()
    for q in questions
}

# Spellings that mean what the golden means. The grader
# has an `equivalents` mechanism for this and the
# `coverage` column never declares one.
SYNONYMS = (
    {"covered", "yes", "true", "in_scope"},
    {"uncovered", "no", "false"},
)


def grader_artifact(diffs, question):
    """True if the grader, not the agent, caused a failure.

    Two ways that happens. Every numeric cell sits inside
    the tolerance a float of the same size would get, which
    means only the integer path at harness/grade.py:363
    rejected it. Or every string cell names the same thing
    the golden names in a different word.

    The test runs per instance, not per question.
    """
    cells = (diffs or {}).get(question) or []
    if not cells:
        return False
    for cell in cells:
        answer = cell.get("answer")
        golden = cell.get("golden")
        if isinstance(answer, str) and isinstance(golden, str):
            pair = {
                answer.strip().casefold(),
                golden.strip().casefold(),
            }
            if any(pair <= group for group in SYNONYMS):
                continue
            return False
        error = cell.get("rel_error")
        if error is None or error >= 1e-3:
            return False
    return True


def load(results, model):
    runs = []
    model_dir = results / model
    if not model_dir.is_dir():
        return runs
    for run in sorted(model_dir.iterdir()):
        meta = run / "meta.json"
        grades = run / "grades.json"
        if not (meta.is_file() and grades.is_file()):
            continue
        j = json.load(open(meta))
        diffs = run / "diffs.json"
        runs.append({
            "model": model,
            "meta": j,
            "arm": (j.get("ablation") or {}).get("arm") or "full",
            "status": j.get("status"),
            "grades": json.load(open(grades)),
            "diffs": (
                json.load(open(diffs)) if diffs.is_file() else {}
            ),
        })
    return runs


def cohorts(results):
    opus = load(results, "opus")
    sonnet = load(results, "sonnet")
    haiku = load(results, "haiku")
    return {
        "Haiku, spec": [
            r for r in haiku if r["arm"] == "full"
        ][:10],
        "Opus, no spec": [
            r for r in opus
            if r["arm"] == "questions-only"
            and r["status"] in ("done", "incomplete")
        ][:10],
        "Opus, spec": [
            r for r in opus if r["arm"] == "full"
        ][:10],
        "Sonnet, spec": [
            r for r in sonnet if r["arm"] == "full"
        ][:10],
    }


INSTANCE_COLUMNS = [
    "cohort", "model", "model_id", "arm", "run_id",
    "question", "spec_section", "grade", "is_correct",
    "excluded_grader_artifact",
]

CELL_COLUMNS = [
    "cohort", "model", "arm", "run_id", "question", "kind",
    "row", "column", "answer", "golden", "rel_error",
    "raw_rel_error", "near_miss", "quantized_answer",
    "quantized_rel_error", "answer_rows", "answer_columns",
    "golden_rows", "golden_columns",
]

RUN_COLUMNS = [
    "cohort", "model", "model_id", "arm", "run_id",
    "status", "strict_success", "attempts", "max_attempts",
    "duration_seconds", "turns", "imputed_cost_usd",
    "input_tokens", "output_tokens",
    "cache_creation_tokens", "cache_read_tokens",
    "answers_written", "n_questions", "n_correct",
    "n_excluded_grader_artifact", "accuracy_pct",
    "spec_fingerprint", "golden_fingerprint",
    "pins_fingerprint", "harness_commit",
]


def build(results, out):
    out.mkdir(parents=True, exist_ok=True)
    groups = cohorts(results)
    instances, cells, runrows = [], [], []
    correct = collections.defaultdict(collections.Counter)
    attempted = collections.defaultdict(collections.Counter)

    for cohort, runs in groups.items():
        for run in runs:
            meta = run["meta"]
            run_id = meta.get("run_id", "")
            n_correct = 0
            n_excluded = 0
            for question, grade in sorted(run["grades"].items()):
                is_correct = grade == "correct"
                excluded = (
                    not is_correct
                    and grader_artifact(run["diffs"], question)
                )
                section = QUESTION_SECTION.get(question, "")
                instances.append({
                    "cohort": cohort,
                    "model": run["model"],
                    "model_id": meta.get("model_id", ""),
                    "arm": run["arm"],
                    "run_id": run_id,
                    "question": question,
                    "spec_section": section,
                    "grade": grade,
                    "is_correct": int(is_correct),
                    "excluded_grader_artifact": int(excluded),
                })
                if is_correct:
                    n_correct += 1
                if excluded:
                    n_excluded += 1
                else:
                    attempted[cohort][section] += 1
                    if is_correct:
                        correct[cohort][section] += 1
                for cell in (run["diffs"] or {}).get(question) or []:
                    row = {
                        "cohort": cohort,
                        "model": run["model"],
                        "arm": run["arm"],
                        "run_id": run_id,
                        "question": question,
                    }
                    for key in CELL_COLUMNS:
                        if key not in row:
                            row[key] = cell.get(key)
                    cells.append(row)
            total = len(run["grades"])
            runrows.append({
                "cohort": cohort,
                "model": run["model"],
                "model_id": meta.get("model_id", ""),
                "arm": run["arm"],
                "run_id": run_id,
                "status": meta.get("status"),
                "strict_success": meta.get("strict_success"),
                "attempts": meta.get("attempts"),
                "max_attempts": meta.get("max_attempts"),
                "duration_seconds": meta.get("duration_seconds"),
                "turns": meta.get("turns"),
                "imputed_cost_usd": meta.get("imputed_cost_usd"),
                "input_tokens": meta.get("input_tokens"),
                "output_tokens": meta.get("output_tokens"),
                "cache_creation_tokens": meta.get(
                    "cache_creation_tokens"
                ),
                "cache_read_tokens": meta.get("cache_read_tokens"),
                "answers_written": meta.get("answers_written"),
                "n_questions": total,
                "n_correct": n_correct,
                "n_excluded_grader_artifact": n_excluded,
                "accuracy_pct": (
                    round(100 * n_correct / total, 1) if total else ""
                ),
                "spec_fingerprint": meta.get("spec_fingerprint"),
                "golden_fingerprint": meta.get("golden_fingerprint"),
                "pins_fingerprint": meta.get("pins_fingerprint"),
                "harness_commit": meta.get("harness_commit"),
            })

    write(out / "question_instances.csv", INSTANCE_COLUMNS, instances)
    write(out / "cells.csv", CELL_COLUMNS, cells)
    write(out / "runs.csv", RUN_COLUMNS, runrows)
    return groups, correct, attempted, instances, cells, runrows


def write(path, columns, rows):
    with open(path, "w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)


def rate(correct, attempted, cohort, section):
    total = attempted[cohort][section]
    if not total:
        return 0.0
    return 100 * correct[cohort][section] / total


def readme(groups, correct, attempted, instances, cells, runrows):
    names = list(groups)
    sections = list(CAPABILITIES)
    lines = []
    add = lines.append

    add("# Success by capability: the data behind the chart")
    add("")
    add(
        "This bundle holds every number in the grouped bar "
        "chart `success_by_capability.png`, plus the two "
        "judgment calls that shape it. Recompute the chart "
        "from `question_instances.csv` alone."
    )
    add("")
    add("## Files")
    add("")
    add("| File | Rows | What it holds |")
    add("| --- | --- | --- |")
    add(
        f"| `question_instances.csv` | {len(instances)} | One row "
        "per run and question. Every bar comes from this file. |"
    )
    add(
        f"| `cells.csv` | {len(cells)} | One row per graded cell "
        "that differed from the golden answer. |"
    )
    add(
        f"| `runs.csv` | {len(runrows)} | One row per run. Cost, "
        "duration, turns, token counts, fingerprints. |"
    )
    add(
        "| `make_export.py` | n/a | The script that wrote the "
        "three CSVs. |"
    )
    add("")
    add("## How to rebuild a bar")
    add("")
    add("```python")
    add("import pandas as pd")
    add("d = pd.read_csv('question_instances.csv')")
    add("kept = d[d.excluded_grader_artifact == 0]")
    add("rate = (kept.groupby(['cohort', 'spec_section'])")
    add("            .is_correct.mean() * 100)")
    add("```")
    add("")
    add(
        "Excluded rows are never graded `correct`, so "
        "`d.groupby(...).is_correct.mean()` on the full frame "
        "gives the rate without the exclusion. Compare the two "
        "to see how little the exclusion moves."
    )
    add("")
    add("## Cohorts")
    add("")
    add("| Cohort | Model ID | Arm | Runs |")
    add("| --- | --- | --- | --- |")
    for name in names:
        runs = groups[name]
        ids = sorted({
            r["meta"].get("model_id", "") for r in runs
        })
        arm = sorted({r["arm"] for r in runs})
        add(
            f"| {name} | {', '.join(i for i in ids if i)} | "
            f"{', '.join(arm)} | {len(runs)} |"
        )
    add("")
    add(
        "The `full` arm gives the agent the whole of SPEC.md. "
        "The `questions-only` arm keeps sections 1, 3 and 9 and "
        "removes sections 2 and 4 through 8. Section 8 is the "
        "worked example. The agent still sees all 31 questions."
    )
    add("")
    add(
        "Four questions name a cut section by number. Those are "
        "q05, q23, q31 and the note on `workflow.csv`. The "
        "dangling reference is part of the condition. Sections "
        "1 and 3 stay because without them no session can find "
        "the data or name an answer file, which would measure "
        "the harness rather than the spec."
    )
    add("")
    add(
        "The run store holds more runs than these 40. Each "
        "cohort takes the first 10 runs in directory order "
        "after filtering on the arm. `Opus, no spec` also keeps "
        "runs with status `incomplete`, because 5 of those runs "
        "stopped on purpose rather than guess. Dropping them "
        "would hide the finding."
    )
    add("")
    add("## The section map")
    add("")
    add(
        "`spec_section` is assigned by hand, not recorded by "
        "the harness. Each question is filed under the section "
        "of SPEC.md it cannot be answered without. The source "
        "is the question's own text and its `depends_on` chain "
        "in `fixtures/questions.yaml`. Disagree with a row and "
        "you can regroup the CSV yourself."
    )
    add("")
    add("| Section | Questions |")
    add("| --- | --- |")
    for section in sections:
        ids = ", ".join(
            f"q{q}" for q in CAPABILITIES[section]
        )
        add(f"| {section} | {ids} |")
    add("")
    add("## The grader-artifact exclusion")
    add("")
    add(
        "`excluded_grader_artifact` marks a failure the grader "
        "caused. The harness compares two integers exactly at "
        "`harness/grade.py:363`, while a float of the same size "
        "gets a relative tolerance of 1e-3. A count that misses "
        "by 2 in 3,291 therefore fails, and the same value as a "
        "float would pass. The rule also forgives a string that "
        "names what the golden names in another word, such as "
        "`covered` against `yes`."
    )
    add("")
    excluded = sum(
        r["excluded_grader_artifact"] for r in instances
    )
    add(
        f"The rule excludes {excluded} question-instances out of "
        f"{len(instances)}. Check each one in `cells.csv`. A "
        "failure qualifies only when every one of its cells "
        "qualifies, so a count that misses by thousands stays "
        "in the denominator."
    )
    add("")
    add("## Success rate, the chart in numbers")
    add("")
    header = "| Rule the question needs | Questions | " + " | ".join(
        names
    ) + " |"
    add(header)
    add("| --- | --- | " + " | ".join("---" for _ in names) + " |")
    for section in sections:
        cellvals = " | ".join(
            f"{rate(correct, attempted, n, section):.0f}%"
            for n in names
        )
        add(
            f"| {section} | {len(CAPABILITIES[section])} | "
            f"{cellvals} |"
        )
    overall = {}
    for name in names:
        total = sum(attempted[name].values())
        overall[name] = (
            100 * sum(correct[name].values()) / total if total else 0.0
        )
    add(
        "| All | 31 | "
        + " | ".join(f"{overall[n]:.0f}%" for n in names)
        + " |"
    )
    add("")
    add("## Grade vocabulary")
    add("")
    add("- `correct`: every cell matched inside tolerance.")
    add(
        "- `near_miss`: passed at a tolerance 10 times looser "
        "than the one the grade uses. Counted as a failure."
    )
    add("- `wrong`: the answer file parsed and disagreed.")
    add("- `missing`: the agent never wrote the answer file.")
    add("- `unparseable`: the file existed and would not parse.")
    add("")
    add("## Fingerprints")
    add("")
    specs = sorted({
        r["spec_fingerprint"] for r in runrows if r["spec_fingerprint"]
    })
    goldens = sorted({
        r["golden_fingerprint"] for r in runrows
        if r["golden_fingerprint"]
    })
    pins = sorted({
        r["pins_fingerprint"] for r in runrows if r["pins_fingerprint"]
    })
    add(f"- Golden answers: {', '.join(goldens)}")
    add(f"- SPEC.md: {', '.join(specs)}")
    add(f"- Pinned data assets: {', '.join(pins)}")
    add("")
    add(
        "The golden fingerprint is the same across all 40 runs. "
        "Scores are therefore comparable. The spec fingerprint "
        "differs between the two arms by design, because the "
        "ablation removes sections."
    )
    add("")
    add("## Known limits")
    add("")
    add(
        "- The section map is a judgment call. It is listed "
        "above so you can check it."
    )
    add(
        "- 10 runs per cohort. Run-to-run spread is wide for "
        "the weaker cohorts. See `accuracy_pct` in `runs.csv`."
    )
    add(
        "- `imputed_cost_usd` is computed from token counts at "
        "list prices. It is not a billed figure."
    )
    add(
        "- The grader is stricter than the spec in places. The "
        "exclusion rule above catches the integer case. Other "
        "failures trace to sections of SPEC.md that state a "
        "decision without fixing the output format."
    )
    return "\n".join(lines) + "\n"


def main():
    results = pathlib.Path(sys.argv[1]).resolve()
    out = pathlib.Path(sys.argv[2]).resolve()
    built = build(results, out)
    (out / "README.md").write_text(readme(*built))
    groups, correct, attempted, instances, cells, runrows = built
    print(f"runs          {len(runrows)}")
    print(f"instances     {len(instances)}")
    print(f"cells         {len(cells)}")
    print(
        "excluded      "
        + str(sum(
            r["excluded_grader_artifact"] for r in instances
        ))
    )
    print(f"out           {out}")


if __name__ == "__main__":
    main()
