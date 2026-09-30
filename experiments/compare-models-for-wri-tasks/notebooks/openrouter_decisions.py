# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "marimo>=0.23.6",
#     "openrouter>=1.2.0",
#     "pandas>=3.0.0",
#     "litellm>=1.80.0",
#     "langfuse>=2.59.7,<3.0.0",
# ]
# ///

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium")

@app.cell
def _():
    import marimo as mo
    import pandas as pd
    import os
    import json
    import time

    return json, mo, os, pd, time


@app.cell
def _(mo):
    mo.md(
        """
    # OpenRouter Decisions API Explorer

    This notebook exercises the OpenRouter **Decisions** API (alpha) using the
    official `openrouter` Python SDK. The Decisions API lets you submit a set of
    *questions* (each with criteria and instructions) plus a *state* (the content
    to evaluate), and returns structured decisions per question.

    Question types:
    - `noul` — boolean (criteria keys are `true` / `false`)
    - `choice` — pick one of several named criteria
    - `score` — score against an ordered list of criteria

    Each answer carries a `type` plus its value (`noul` probability, `choice`
    label, or `score` position), with `confidence` and `probabilities` for
    `choice`/`score`. The Decisions router is served by the TypeSafe `Jev`
    model (`typesafe/jev-1.13`); other model slugs are not supported.

    Docs: https://openrouter.ai/docs/client-sdks/python/sdks/decisions/README
    """
    )
    return


@app.cell
def _(mo, os):
    # Check required environment variables
    required_vars = {
        "OPENROUTER_API_KEY": "OpenRouter API key (required for the Decisions API)",
        "LANGFUSE_PUBLIC_KEY": "Langfuse public key (for tracing)",
        "LANGFUSE_SECRET_KEY": "Langfuse secret key (for tracing)",
    }

    env_status = []
    for var, desc in required_vars.items():
        if var in os.environ and os.environ[var]:
            env_status.append(f"✅ **{var}**: Set")
        else:
            env_status.append(f"❌ **{var}**: Not set - {desc}")

    mo.md(
        f"""
    ## Environment Variables Status

    {chr(10).join(env_status)}
    """
    )
    return


@app.cell
def _(mo, os):
    mo.stop(
        not (os.environ.get("OPENROUTER_API_KEY")),
        mo.md("⚠️ **Set `OPENROUTER_API_KEY` to use this notebook.**"),
    )

    from openrouter import OpenRouter

    client = OpenRouter(
        api_key=os.environ["OPENROUTER_API_KEY"],
        x_open_router_title="wri-applied-ai-experiments",
    )
    return (client,)


@app.cell
def _(mo):
    # UI: model + state input. Model choices come from util.DECISIONS_MODELS.
    from util import DECISIONS_MODELS

    model_input = mo.ui.dropdown(
        options=DECISIONS_MODELS,
        value="Typesafe JEV 1.13 (pinned)",
        label="Decisions model (OpenRouter slug)",
        full_width=True,
    )

    state_input = mo.ui.text_area(
        value=(
            "My checkout page shows a blank screen after I click Pay. "
            "I have tried two browsers. This is blocking our enterprise rollout."
        ),
        label="State (content to evaluate)",
        full_width=True,
        rows=6,
    )

    mo.vstack([model_input, state_input])
    return model_input, state_input

@app.cell
def _(json, mo):
    # UI: question definitions (JSON editor)
    default_questions = {
        "is_bug": {
            "criteria": {
                "false": "The customer is asking a question or requesting a feature.",
                "true": "The customer describes broken or unexpected product behavior.",
            },
            "instructions": "Is the customer reporting a software defect?",
            "type": "noul",
        },
        "team": {
            "criteria": {
                "account": "Login, permissions, or profile issues.",
                "frontend": "Rendering, layout, or browser compatibility issues.",
                "payments": "Checkout, billing, or payment processing issues.",
            },
            "instructions": "Which team should own this ticket?",
            "type": "choice",
        },
        "urgency": {
            "criteria": [
                "Can wait for the next release",
                "Should be fixed this week",
                "Blocking revenue right now",
            ],
            "instructions": "How urgent is this ticket?",
            "type": "score",
        },
    }

    # Wrap the editor in a form: the value is None until the user clicks the
    # form's submit button, and it persists afterwards. This avoids the
    # run_button race where the value resets to False as soon as the
    # referencing cell finishes, causing mo.stop to trip on re-runs.
    questions_form = mo.ui.code_editor(
        value=json.dumps(default_questions, indent=2),
        language="json",
        label="Questions definition (JSON)",
        min_height=320,
    ).form(
        bordered=True,
        submit_button_label="Submit Decisions request",
        submit_button_tooltip="Send the questions + state to the Decisions API",
    )

    questions_form
    return (questions_form,)


@app.cell
def _(client, json, mo, model_input, questions_form, state_input, time):
    # The form's value is None until submitted; afterwards it holds the
    # submitted editor content and persists (no reset race like run_button).
    mo.stop(
        questions_form.value is None,
        mo.md("👆 Edit the questions and click **Submit Decisions request**."),
    )

    # Marimo cells may only have a single trailing `return`, so instead of
    # bailing out early we guard the happy path and always export the variable.
    decisions_response = None
    status_output = None

    try:
        questions = json.loads(questions_form.value)
    except json.JSONDecodeError as e:
        status_output = mo.md(
            f"❌ **Invalid JSON in questions definition**: {e}"
        )
        questions = None

    if questions is not None:
        status_output = mo.md("🔄 **Submitting Decisions request...**")

        from langfuse import Langfuse
        from langfuse.decorators import observe

        langfuse = Langfuse()

        @observe(name="openrouter.decisions", as_type="generation")
        def _submit():
            if hasattr(langfuse, "update_current_trace"):
                langfuse.update_current_trace(
                    name="openrouter-decisions",
                    session_id="openrouter-decisions-notebook",
                    metadata={"model": model_input.value, "questions": list(questions.keys())},
                )
            if hasattr(langfuse, "update_current_observation"):
                langfuse.update_current_observation(
                    model=model_input.value,
                    input={"questions": questions, "state": state_input.value},
                    metadata={"api": "openrouter.decisions", "alpha": True},
                )
            return client.alpha.decisions.create(
                model=model_input.value,
                questions=questions,
                state=state_input.value,
            )

        t0 = time.perf_counter()
        try:
            decisions_response = _submit()
            latency = time.perf_counter() - t0

            # Record output + usage on the generation span.
            _data = json.loads(decisions_response.model_dump_json())
            _usage = _data.get("usage", {})
            if hasattr(langfuse, "update_current_observation"):
                langfuse.update_current_observation(
                    output=_data.get("answers"),
                    usage_details={
                        "input": _usage.get("input_tokens"),
                        "output": _usage.get("output_tokens"),
                        "total": _usage.get("total_tokens"),
                    },
                    metadata={
                        "provider": _data.get("provider"),
                        "cost": _usage.get("cost"),
                        "latency_s": latency,
                    },
                )
            langfuse.flush()
            status_output = mo.md(
                f"✅ **Completed in {latency:.2f} seconds** (traced to Langfuse)"
            )
        except Exception as e:
            langfuse.flush()
            status_output = mo.md(
                f"❌ **Request failed** ({type(e).__name__}): {e}"
            )

    return decisions_response, status_output


@app.cell
def _(mo, status_output):
    mo.stop(status_output is None)
    status_output
    return


@app.cell
def _(decisions_response, mo):
    mo.stop(not decisions_response)

    # `decisions_response` is a Pydantic model; render it as JSON rather than
    # its repr so the nested answers are readable.
    raw_json = decisions_response.model_dump_json(indent=2)
    mo.md(f"## Raw Response\n\n```json\n{raw_json}\n```")
    return


@app.cell
def _(decisions_response, json, mo, pd):
    mo.stop(not decisions_response)

    # One row per question decision. Each answer is a discriminated union on
    # `type`:
    #   noul   -> `noul` is P(yes)
    #   choice -> `choice` is the label; `probabilities` per option
    #   score  -> `score` is the probability-weighted position
    data = json.loads(decisions_response.model_dump_json())
    answers = data.get("answers", {})

    rows = []
    for question, answer in answers.items():
        answer_type = answer.get("type")
        row = {
            "question": question,
            "type": answer_type,
            "answer": answer.get(answer_type) if answer_type else None,
            "confidence": answer.get("confidence"),
            "probabilities": (
                json.dumps(answer["probabilities"])
                if "probabilities" in answer
                else None
            ),
            "legend": (
                json.dumps(answer["legend"]) if "legend" in answer else None
            ),
        }
        rows.append(row)

    if rows:
        df = pd.DataFrame(rows)
        usage = data.get("usage", {})
        usage_md = (
            f"**Model**: `{data.get('model')}` &nbsp;·&nbsp; "
            f"**Provider**: {data.get('provider')} &nbsp;·&nbsp; "
            f"**Tokens**: {usage.get('input_tokens')} in / "
            f"{usage.get('output_tokens')} out &nbsp;·&nbsp; "
            f"**Cost**: ${usage.get('cost')}"
        )
        output = mo.vstack(
            [mo.md("## Decisions Table"), mo.ui.table(df), mo.md(usage_md)]
        )
    else:
        output = mo.md("No answers found — see raw response above.")

    output
    return


@app.cell
def _(mo):
    mo.md(
        """
    ---
    ## Notes

    - The Decisions API is an **alpha** feature; the response shape may change.
    - Requires `OPENROUTER_API_KEY` with access to the alpha endpoints.
    - `model` must be a Decisions/System One model — `typesafe/jev-1.13`
      (pinned) or `~typesafe/jev-latest` (tracks the current release). General
      chat models are not served by this endpoint.
    - Answers are typed, not free text: `noul` returns P(yes), `choice` returns
      the selected label, and `score` returns the probability-weighted position
      on your ordered criteria. `choice`/`score` also include `confidence` and
      per-option `probabilities`.
    - The `state` parameter accepts a plain string, or a JSON object/array of
      related context.
    - Optional extras supported by the SDK: `session_id`, `trace`, `provider`,
      `user`, and app-identification headers (`http_referer`,
      `x_open_router_title`, `x_open_router_categories`).
    """
    )
    return


if __name__ == "__main__":
    app.run()
