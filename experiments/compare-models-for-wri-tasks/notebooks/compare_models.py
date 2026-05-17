# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "langfuse>=2.59.7,<3.0.0",
#     "litellm>=1.60.0",
#     "marimo>=0.23.6",
#     "pandas>=3.0.0",
# ]
# ///

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import asyncio
    import pandas as pd
    import os
    import time

    return asyncio, mo, os, pd, time


@app.cell
def _(mo):
    mo.md("""
    # Test LLM Query Utility

    Testing the `util.py` module with async model queries.
    """)
    return


@app.cell
def _():
    # Import utility functions
    from util import LMModel, query_model, MODEL_REGISTRY

    return MODEL_REGISTRY, query_model


@app.cell
def _(mo, os):
    # Check required environment variables
    required_vars = {
        "LANGFUSE_PUBLIC_KEY": "Langfuse public key",
        "LANGFUSE_SECRET_KEY": "Langfuse secret key", 
        "LANGFUSE_HOST": "Langfuse host (optional, defaults to cloud.langfuse.com)",
        "OPENAI_API_KEY": "OpenAI API key for GPT models",
        "OPENROUTER_API_KEY": "OpenRouter API key for Qwen models",
    }

    env_status = []
    for var, desc in required_vars.items():
        if var in os.environ and os.environ[var]:
            env_status.append(f"✅ **{var}**: Set")
        else:
            env_status.append(f"❌ **{var}**: Not set - {desc}")

    mo.md(f"""
    ## Environment Variables Status

    {chr(10).join(env_status)}
    """)
    return


@app.cell(hide_code=True)
def _(MODEL_REGISTRY, mo):
    # Display available models

    models_list = "\n".join(
        [
            f"- **{key}**: {model.name} (`{model.model}`)"
            for key, model in MODEL_REGISTRY.items()
        ]
    )

    mo.md(f"""
    ## Available Models

    {models_list}
    """)
    return


@app.cell
def _(model_selector):
    model_selector
    return


@app.cell
def _(mo):

    # Create UI for prompt input
    prompt_input = mo.ui.text_area(
        value="Explain angular momentum in simple terms and less than 100 words",
        label="Enter your prompt",
        full_width=True,
    )

    temperature_slider = mo.ui.slider(
        start=0.0, stop=2.0, step=0.1, value=0.2, label="Temperature"
    )

    run_button = mo.ui.run_button(label="Query Models")

    mo.vstack([prompt_input, temperature_slider, run_button])
    return prompt_input, run_button, temperature_slider


@app.cell(hide_code=True)
async def _(
    MODEL_REGISTRY,
    asyncio,
    mo,
    model_selector,
    prompt_input,
    query_model,
    run_button,
    temperature_slider,
    time,
):
    # Only run when button is clicked
    mo.stop(not run_button.value or not prompt_input.value.strip())

    # Get all models from registry
    models = list(MODEL_REGISTRY.values())

    selected_model_names = model_selector.value
    sel_models = [m for m in models if m.name in selected_model_names]

    mo.stop(not sel_models)

    # Query all models in parallel
    mo.md("🔄 **Querying models...**")

    # Start timer
    start_time = time.perf_counter()

    results = await asyncio.gather(
        *[
            query_model(m, prompt_input.value, temperature=temperature_slider.value)
            for m in sel_models
        ]
    )

    # Calculate total time
    total_time = time.perf_counter() - start_time

    mo.md(f"✅ **Sent query to {len(sel_models)} model(s) (out of {len(models)} available)... completed in {total_time:.2f} seconds**")
    #results
    return results, sel_models


@app.cell
def _(sel_models):
    sel_models
    return


@app.cell(hide_code=True)
def _(mo, results):
    # Display results
    mo.stop(not results)

    output_sections = []

    for result in results:
        if result["success"]:
            output_sections.append(
                mo.md(f"""
    ---
    ### {result["model"]}

    **Latency**: {result["latency_s"]:.2f}s  
    **Tokens**: {result["usage"]["total_tokens"]} (prompt: {result["usage"]["prompt_tokens"]}, completion: {result["usage"]["completion_tokens"]})  
    **Cost**: ${result.get("cost", "N/A")}  
    **Finish Reason**: {result["finish_reason"]}

    #### Response:
    {result["text"]}
            """)
            )
        else:
            output_sections.append(
                mo.md(f"""
    ---
    ### {result["model"]} ❌

    **Error**: {result["error"]}  
    **Error Type**: {result["error_type"]}  
    **Latency**: {result["latency_s"]:.2f}s
            """)
            )

    mo.vstack(output_sections)
    return


@app.cell(hide_code=True)
def _(mo, pd, results):
    # Create comparison table
    mo.stop(not results)

    comparison_data = []
    for r in results:
        if r["success"]:
            comparison_data.append(
                {
                    "Model": r["model"],
                    "Latency (s)": f"{r['latency_s']:.2f}",
                    "Total Tokens": r["usage"]["total_tokens"],
                    "Prompt Tokens": r["usage"]["prompt_tokens"],
                    "Completion Tokens": r["usage"]["completion_tokens"],
                    "Cost ($)": f"{r.get('cost', 0):.6f}" if r.get("cost") else "N/A",
                    "Status": "✅",
                }
            )
        else:
            comparison_data.append(
                {
                    "Model": r["model"],
                    "Latency (s)": f"{r['latency_s']:.2f}",
                    "Total Tokens": "N/A",
                    "Prompt Tokens": "N/A",
                    "Completion Tokens": "N/A",
                    "Cost ($)": "N/A",
                    "Status": f"❌ {r['error_type']}",
                }
            )

    df = pd.DataFrame(comparison_data)

    mo.vstack([mo.md("## Comparison Table"), mo.ui.table(df)])
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ---
    ## Environment Setup

    Make sure these environment variables are set:
    - `LANGFUSE_PUBLIC_KEY`
    - `LANGFUSE_SECRET_KEY`
    - `LANGFUSE_HOST`
    - `OPENAI_API_KEY` (for GPT-5.2)
    - `OPENROUTER_API_KEY` (for Qwen3-32B)
    """)
    return


@app.cell
def _(mo):
    from util import get_models_ordered_by_size

    # Create multiselect with models ordered by size
    model_selector = mo.ui.multiselect(
        options=get_models_ordered_by_size(),
        value=[],  # Default: no models selected
        label="Select models to query",
        full_width=True
    )
    return (model_selector,)


@app.cell
def _():
    return


if __name__ == "__main__":
    app.run()
