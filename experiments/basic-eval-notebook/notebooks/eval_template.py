"""Basic eval notebook — copy and modify.

Three templates: summarisation, extraction, classification. Each section is
self-contained: load cases → run model → score → display.

The notebook works without an API key (stubbed model calls + token-overlap
proxy for LLM-as-judge), so you can read the flow first and add credentials
when ready to evaluate a real model.
"""

import marimo

__generated_with = "0.23.4"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    return (mo,)


@app.cell
def _(mo):
    mo.md(
        r"""
        # Basic Eval Notebook

        A copy-and-modify template for evaluating an LLM on a specific task in
        under an hour. Three templates are baked in:

        1. **Summarisation** — ROUGE-L overlap + LLM-as-judge faithfulness.
        2. **Extraction** — field-level exact match.
        3. **Classification** — macro-averaged precision / recall / F1.

        ## How to use this

        1. Pick the template that matches your task.
        2. Replace `data/<task>.yaml` with your own cases (same shape).
        3. Re-run the section. The score table updates automatically.

        > **No API key?** The notebook falls back to deterministic stubs so you
        > can see the full flow. Set `ANTHROPIC_API_KEY` in your environment to
        > evaluate a real model.
        """
    )
    return


@app.cell
def _():
    import os
    import sys
    from pathlib import Path

    NOTEBOOK_DIR = Path(__file__).resolve().parent
    EXPERIMENT_DIR = NOTEBOOK_DIR.parent
    sys.path.insert(0, str(EXPERIMENT_DIR))

    DATA_DIR = EXPERIMENT_DIR / "data"
    OUTPUT_DIR = EXPERIMENT_DIR / "outputs"
    OUTPUT_DIR.mkdir(exist_ok=True)

    HAS_API_KEY = bool(os.environ.get("ANTHROPIC_API_KEY"))
    return DATA_DIR, HAS_API_KEY, OUTPUT_DIR


@app.cell
def _():
    import pandas as pd
    import yaml
    from rouge_score import rouge_scorer
    from sklearn.metrics import classification_report, confusion_matrix

    from src.judge import judge_faithfulness
    from src.runner import call_classify, call_extract, call_summarise

    def load_cases(path):
        with open(path) as f:
            return yaml.safe_load(f)["cases"]

    return (
        call_classify,
        call_extract,
        call_summarise,
        classification_report,
        confusion_matrix,
        judge_faithfulness,
        load_cases,
        pd,
        rouge_scorer,
    )


@app.cell
def _(HAS_API_KEY, mo):
    mo.callout(
        mo.md(
            f"**API key detected:** `{HAS_API_KEY}` — "
            + ("real model calls enabled." if HAS_API_KEY else "running with stubs. Set `ANTHROPIC_API_KEY` to evaluate a real model.")
        ),
        kind="info" if HAS_API_KEY else "warn",
    )
    return


@app.cell
def _(mo):
    mo.md("---\n## 1. Summarisation")
    return


@app.cell
def _(DATA_DIR, load_cases):
    summarisation_cases = load_cases(DATA_DIR / "summarization.yaml")
    return (summarisation_cases,)


@app.cell
def _(call_summarise, judge_faithfulness, rouge_scorer, summarisation_cases):
    _scorer = rouge_scorer.RougeScorer(["rougeL"], use_stemmer=True)
    summarisation_results = []
    for _case in summarisation_cases:
        _output = call_summarise(_case["input"])
        _rouge = _scorer.score(_case["expected"], _output)["rougeL"].fmeasure
        _verdict = judge_faithfulness(
            output=_output, reference=_case["expected"], source=_case["input"]
        )
        summarisation_results.append(
            {
                "id": _case["id"],
                "tags": ", ".join(_case.get("tags", [])),
                "rouge_l": round(_rouge, 2),
                "judge_score": _verdict.score,
                "faithful": _verdict.faithful,
                "output": _output.strip(),
                "judge_reasoning": _verdict.reasoning,
            }
        )
    return (summarisation_results,)


@app.cell
def _(mo, pd, summarisation_results):
    df_summ = pd.DataFrame(summarisation_results)
    summ_aggregate = {
        "mean_rouge_l": round(df_summ["rouge_l"].mean(), 2),
        "mean_judge_score": round(df_summ["judge_score"].mean(), 2),
        "faithful_rate": round(df_summ["faithful"].mean(), 2),
        "n_cases": len(df_summ),
    }

    mo.vstack(
        [
            mo.md(
                f"**Aggregate:** ROUGE-L mean = `{summ_aggregate['mean_rouge_l']}`, "
                f"judge mean = `{summ_aggregate['mean_judge_score']}`, "
                f"faithful rate = `{summ_aggregate['faithful_rate']}` "
                f"(n={summ_aggregate['n_cases']})."
            ),
            mo.ui.table(df_summ, page_size=10),
        ]
    )
    return df_summ, summ_aggregate


@app.cell
def _(mo):
    mo.md(
        r"""
        > **Look for:** Cases where ROUGE-L is high but `faithful` is False —
        > those are the dangerous failures. The model produced something that
        > looks lexically close to the reference but added or misattributed a
        > claim. `case_03` (attribution-ambiguity) is the canonical example.
        """
    )
    return


@app.cell
def _(mo):
    mo.md("---\n## 2. Extraction")
    return


@app.cell
def _(DATA_DIR, load_cases):
    extraction_cases = load_cases(DATA_DIR / "extraction.yaml")
    return (extraction_cases,)


@app.cell
def _(call_extract, extraction_cases):
    def _normalise(value):
        if value is None:
            return None
        if isinstance(value, list):
            return tuple(sorted(str(v).strip().lower() for v in value))
        if isinstance(value, (int, float)):
            return value
        return str(value).strip().lower()

    extraction_results = []
    for _case in extraction_cases:
        _expected = _case["expected"]
        _predicted = call_extract(_case["input"], _expected)
        _field_hits = {}
        for _field, _exp_value in _expected.items():
            _pred_value = _predicted.get(_field)
            _field_hits[_field] = _normalise(_pred_value) == _normalise(_exp_value)
        _n_fields = len(_expected)
        _n_correct = sum(_field_hits.values())
        extraction_results.append(
            {
                "id": _case["id"],
                "tags": ", ".join(_case.get("tags", [])),
                "n_fields": _n_fields,
                "n_correct": _n_correct,
                "accuracy": round(_n_correct / _n_fields, 2) if _n_fields else 0.0,
                "missed_fields": ", ".join(f for f, ok in _field_hits.items() if not ok),
            }
        )
    return (extraction_results,)


@app.cell
def _(extraction_results, mo, pd):
    df_ext = pd.DataFrame(extraction_results)
    ext_aggregate = {
        "mean_accuracy": round(df_ext["accuracy"].mean(), 2),
        "n_cases": len(df_ext),
        "fully_correct": int((df_ext["accuracy"] == 1.0).sum()),
    }

    mo.vstack(
        [
            mo.md(
                f"**Aggregate:** mean field accuracy = `{ext_aggregate['mean_accuracy']}`, "
                f"fully-correct cases = `{ext_aggregate['fully_correct']}/{ext_aggregate['n_cases']}`."
            ),
            mo.ui.table(df_ext, page_size=10),
        ]
    )
    return df_ext, ext_aggregate


@app.cell
def _(mo):
    mo.md(
        r"""
        > **Look for:** patterns in `missed_fields`. If date fields fail
        > consistently, you have a date-format issue (see `case_02`). If
        > currency fields fail, the model is normalising inconsistently
        > (`case_04`). These patterns are more useful than a single accuracy
        > number.
        """
    )
    return


@app.cell
def _(mo):
    mo.md("---\n## 3. Classification")
    return


@app.cell
def _(DATA_DIR, load_cases):
    classification_cases = load_cases(DATA_DIR / "classification.yaml")
    return (classification_cases,)


@app.cell
def _(call_classify, classification_cases):
    LABELS = ["supportive", "critical", "neutral"]
    classification_results = []
    for _case in classification_cases:
        _predicted = call_classify(_case["input"], LABELS)
        classification_results.append(
            {
                "id": _case["id"],
                "tags": ", ".join(_case.get("tags", [])),
                "expected": _case["expected"],
                "predicted": _predicted,
                "correct": _predicted == _case["expected"],
            }
        )
    return LABELS, classification_results


@app.cell
def _(
    LABELS,
    classification_report,
    classification_results,
    confusion_matrix,
    mo,
    pd,
):
    df_cls = pd.DataFrame(classification_results)
    _y_true = df_cls["expected"].tolist()
    _y_pred = df_cls["predicted"].tolist()
    _report = classification_report(
        _y_true, _y_pred, labels=LABELS, output_dict=True, zero_division=0
    )
    macro = _report["macro avg"]
    _cm = confusion_matrix(_y_true, _y_pred, labels=LABELS)
    _cm_df = pd.DataFrame(
        _cm,
        index=[f"true_{l}" for l in LABELS],
        columns=[f"pred_{l}" for l in LABELS],
    )

    mo.vstack(
        [
            mo.md(
                f"**Aggregate:** macro precision = `{round(macro['precision'], 2)}`, "
                f"macro recall = `{round(macro['recall'], 2)}`, "
                f"macro F1 = `{round(macro['f1-score'], 2)}` (n={len(df_cls)})."
            ),
            mo.md("**Per-case results:**"),
            mo.ui.table(df_cls, page_size=10),
            mo.md("**Confusion matrix:**"),
            mo.ui.table(_cm_df.reset_index().rename(columns={"index": ""}), page_size=10),
        ]
    )
    return df_cls, macro


@app.cell
def _(mo):
    mo.md(
        r"""
        > **Look for:** off-diagonal cells in the confusion matrix. If the
        > model confuses `critical` for `supportive`, it is probably
        > surface-skimming sentiment instead of weighing the dominant claim
        > (see `case_03`, `case_07`). That is exactly the kind of non-obvious
        > quality issue a basic eval is meant to surface.
        """
    )
    return


@app.cell
def _(mo):
    mo.md("---\n## Save run for later comparison")
    return


@app.cell
def _(OUTPUT_DIR, df_cls, df_ext, df_summ, ext_aggregate, macro, summ_aggregate):
    import json
    from datetime import datetime, timezone

    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    payload = {
        "run_id": run_id,
        "summarisation": {"aggregate": summ_aggregate, "cases": df_summ.to_dict(orient="records")},
        "extraction": {"aggregate": ext_aggregate, "cases": df_ext.to_dict(orient="records")},
        "classification": {
            "aggregate": {
                "macro_precision": round(macro["precision"], 2),
                "macro_recall": round(macro["recall"], 2),
                "macro_f1": round(macro["f1-score"], 2),
            },
            "cases": df_cls.to_dict(orient="records"),
        },
    }
    out_path = OUTPUT_DIR / f"run_{run_id}.json"
    out_path.write_text(json.dumps(payload, indent=2, default=str))
    return (out_path,)


@app.cell
def _(mo, out_path):
    mo.md(f"Saved run to `{out_path.relative_to(out_path.parents[1])}`.")
    return


@app.cell
def _(mo):
    mo.md(
        r"""
        ---
        ## Customise this for your task

        1. **Pick a template.** Most tasks fit one of the three above; if not,
           extraction-with-rubric is usually the right starting point.
        2. **Replace `data/<task>.yaml`.** Keep the schema. Aim for 6–12 cases
           — enough variation to be informative, few enough to scan by eye.
        3. **Seed at least one known-bad case.** The notebook is supposed to
           reveal quality issues. If your real data is clean, add a case with
           a known issue so you can confirm the eval would catch it.
        4. **Replace the model in `src/runner.py`** if you are evaluating a
           non-Anthropic model. The interface is one function per template.
        5. **Run the notebook end-to-end** and write down the first three
           failures you see in `outputs/`. Those are your real findings.

        When this notebook stops being enough — usually around the time you
        want CI integration, parameter sweeps, or comparison plots across
        runs — graduate to the full [`eval-harness-starter`](../eval-harness-starter)
        experiment.
        """
    )
    return


if __name__ == "__main__":
    app.run()
