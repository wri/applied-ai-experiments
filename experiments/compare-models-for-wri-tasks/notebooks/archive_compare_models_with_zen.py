# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "langfuse>=2.59.7,<3.0.0",
#     "marimo>=0.23.6",
#     "openai>=1.0.0",
#     "requests>=2.0.0",
# ]
#
# [tool.marimo.runtime]
# auto_instantiate = false
# ///

import marimo

__generated_with = "0.19.7"
app = marimo.App(width="medium")

with app.setup:
    import marimo as mo
    import os
    import time

    import requests
    import json

    from langfuse.openai import OpenAI
    from langfuse import observe
    #from langfuse.utils import propagate_attributes


@app.cell(hide_code=True)
def _(LM_MODELS):
    model_names = [m.name for m in LM_MODELS]
    model_names_display = "<br>".join(model_names)

    mo.md(f"""
    # Compare Model Responses

    This notebook allows you to enter a prompt and get responses from one of several available models. The results are stored in Langfuse

    A model can be selected from a dropdown list and includes:<br>
    {model_names_display}
    """)
    return


@app.cell
def _():
    mo.md(r"""
    ## Notes to self.

    * Traces go to Langfuse
    * Langfuse project
      * https://us.cloud.langfuse.com/project/cmkzywmcg02t8ad07m7comem2/traces

    Plan
    * Consider a "usecase" that meets WRI interests for a demo
    * Add to wri-experiments
    * Add another provider, beyond Zen, ideally ollama cloud or other that has small open weights models
    * Send the same query to many models at once
    * Add a trace_name tag or session id to the query to be able to quickly open and compare in Langfuse
       * Use metadatakey with some unique id
       * Langfuse base URL + traces?search={metadatakey?}
    * Maybe a compare_models dashboard in LF with the same filter
        * see compare-models-01
    """)
    return


@app.cell
def _():

    ##  Langfuse credentials expected
    # os.environ["LANGFUSE_PUBLIC_KEY"] = "pk-lf-..."
    # os.environ["LANGFUSE_SECRET_KEY"] = "sk-lf-..."
    # os.environ["LANGFUSE_BASE_URL"] = "https://cloud.langfuse.com"

    ## OpenCode Zen credentials expected
    # os.environ["ZEN_API_KEY"] = "zen-..."
    # os.environ["ZEN_BASE_URL"] = "https://api.opencode.ai/v1"  # <-- Zen endpoint
    # os.environ["ZEN_BASE_URL"] = "https://opencode.ai/zen/v1"  # <-- Zen endpoint 

    os.environ["ZEN_BASE_URL"] = "https://opencode.ai/zen/v1"  

    required_env_vars = [
        "LANGFUSE_PUBLIC_KEY",
        "LANGFUSE_SECRET_KEY",
        "LANGFUSE_BASE_URL",
        "ZEN_API_KEY",
        "ZEN_BASE_URL"
    ]

    missing_env_vars = [var for var in required_env_vars if var not in os.environ]
    if missing_env_vars:
        print(f"**Missing environment variables:** {', '.join(missing_env_vars)}")
    else:
        print("✅ All required environment variables are set.")
    return


@app.cell(hide_code=True)
def _(model_options):
    # UI elements for endpoint, API key, prompt, and button

    prompt_input_ui = mo.ui.text_area(
        value="",
        label="Prompt",
        full_width=True
    )


    model_select_ui = mo.ui.dropdown(options=model_options, label="Select a model", )
    run_button = mo.ui.run_button(label="Query LLM")

    mo.vstack([
        model_select_ui,
        prompt_input_ui,
        run_button
    ])
    return model_select_ui, prompt_input_ui, run_button


@app.cell
def _(resp):
    resp
    return


@app.cell(hide_code=True)
def _(prompt_input_ui, run_button, run_zen_llm_query):
    # This cell runs the query
    go_condition = run_button.value and (prompt_input_ui.value.strip() != '')
    mo.stop(not go_condition)

    print ("Sending Query!")
    resp = run_zen_llm_query()
    resp
    return (resp,)


@app.cell(hide_code=True)
def _(model_select_ui, prompt_input_ui, resp):
    mo.stop(model_select_ui.value is None)
    mo.md(rf"""

    ## Query 
    Running user query using model: **{model_select_ui.value.name}** ({model_select_ui.value.id}) from **{model_select_ui.value.provider}** <br> 

    ```{prompt_input_ui.value}```<br>

    ## Model response
    ```md
    {resp}
    ```
    """)
    return


@app.cell(hide_code=True)
def _():
    mo.md(r"""
    ## ----
    """)
    return


@app.cell
def _():

    # zen_client = OpenAI(
    #         api_key=os.environ["ZEN_API_KEY"],
    #         base_url="https://opencode.ai/zen/v1",
    #     )
    # _prompt = prompt_input_ui.value.strip()

    # resp = zen_client.responses.create(
    #            model="gpt-5.2",     # must be one of the zen models that "client.response" api
    #            input = _prompt,

    #    )
    return


@app.cell
def _():
    # client = OpenAI(
    #     api_key=os.environ["ZEN_API_KEY"],
    #     base_url=os.environ["ZEN_BASE_URL"]
    # )

    # prompt = prompt_input.value

    # t0 = time.perf_counter()
    # resp = client.responses.create(
    #     name="marimo-zen-test",
    #     model="gpt-5.2",  # whatever Zen model ID you want
    #     #messages=[{"role": "user", "content": prompt}],
    #     input=prompt,
    #     temperature=0.2,
    #     metadata={
    #         "langfuse_tags": ["marimo", "zen"],
    #         "provider": "opencode-zen",
    #     },
    # )
    # latency = time.perf_counter() - t0
    return


@app.cell(hide_code=True)
def _():
    mo.md(r"""
    ## Helper Functions and Model List
    """)
    return


@app.cell
def _(model_select_ui, prompt_input_ui):
    # This is the main function to run the LLM Query
    def run_zen_llm_query():
        # This is the Zen Client

        trace_name = "marimo-zen-test"

        # get values from ui
        _prompt = prompt_input_ui.value.strip()
        _model = model_select_ui.value
        temperature = 0.2
        # _model is LMModel(name='GPT 5.2', provider='zen', id='gpt-5.2', api='responses')

        # replace all these unnecessary
        _api = _model.api
        _provider = _model.provider
        _model_id = _model.id 
        _model

        zen_client = OpenAI(
            api_key=os.environ["ZEN_API_KEY"],
            base_url=os.environ["ZEN_BASE_URL"]
        )

        t0 = time.perf_counter()

        if _api == "responses":
            r = zen_client.responses.create(

                model=_model_id,
                input=_prompt,
                # only available for some models: temperature=temperature,
                name=trace_name,  # supported by the LF wrapper
                #metadata=merged_meta,  # supported by the LF wrapper
            )
            resp = r.output_text


        elif _api == "chat":
            r = zen_client.chat.completions.create(
                model=_model_id,
                messages=[{
                    "role": "user", 
                    "content": _prompt,
                }],
                temperature=temperature,

                name=trace_name,  # supported by the LF wrapper
                #metadata=merged_meta,  # supported by the LF wrapper
            )
            resp = r.choices[0].message.content

        elif _api == "messages":
            raise NotImplementedError

        else: 
            raise Exception()

        latency = time.perf_counter() - t0
        print (f"Latency: {latency:02f}")

        return resp
    return (run_zen_llm_query,)


@app.cell
def _():
    from dataclasses import dataclass

    @dataclass(frozen=True)
    class LMModel:
        name: str          # human-friendly display name
        provider: str      # "zen" | "ollama" | ...
        id: str            # provider-specific model id
        api: str           # "responses" | "chat" | "messages" | "ollama"
    return (LMModel,)


@app.cell
def _(LMModel):
    LM_MODELS_ZEN = [
         ## provider = zen
         # OpenAI /responses
        LMModel(name="GPT 5.2", provider="zen", id="gpt-5.2", api="responses"),
        #LMModel(name="GPT 5.2 Codex", provider="zen", id="gpt-5.2-codex", api="responses"),
        #LMModel(name="GPT 5.1", provider="zen", id="gpt-5.1", api="responses"),
        LMModel(name="GPT 5.1 Codex Mini", provider="zen", id="gpt-5.1-codex-mini", api="responses"),

        # OpenAI-compatible /chat/completions
        LMModel(name="Big Pickle", provider="zen", id="big-pickle", api="chat"),
        LMModel(name="Qwen3 Coder 480B", provider="zen", id="qwen3-coder", api="chat"),
        #LMModel(name="Kimi K2 Thinking", provider="zen", id="kimi-k2-thinking", api="chat"),
        #LMModel(name="GLM 4.7", provider="zen", id="glm-4.7", api="chat"),

        # Anthropic /messages
        #LMModel(name="Claude Sonnet 4.5", provider="zen", id="claude-sonnet-4-5", api="messages"),
        #LMModel(name="Claude Opus 4.5", provider="zen", id="claude-opus-4-5", api="messages"),

    ]

    LM_MODELS_SMALL = [
        # Ollama Cloud (hosted small OSS models)
        LMModel(name="Ollama 7B Cloud", provider="ollama_cloud", id="ollama:7b-cloud", api="chat"),
        LMModel(name="Ollama 7B", provider="ollama_cloud", id="ollama:7b", api="chat"),
        LMModel(name="Ollama Mini", provider="ollama_cloud", id="ollama:mini-cloud", api="chat"),

        # HuggingFace Inference small models
        LMModel(name="Falcon 7B Instruct", provider="huggingface", id="tiiuae/falcon-7b-instruct", api="chat"),
        LMModel(name="Mistral 7B Instruct", provider="huggingface", id="mistralai/mistral-7b-instruct", api="chat"),
        LMModel(name="LLaMA-2 7B Chat", provider="huggingface", id="meta/llama-2-7b-chat-hf", api="chat"),

        # OpenAI low-cost endpoints
        LMModel(name="GPT-3.5 Turbo 16k", provider="openai", id="gpt-3.5-turbo-16k", api="chat"),
        LMModel(name="GPT-3.5 Turbo", provider="openai", id="gpt-3.5-turbo", api="chat"),

        # Cohere small
        LMModel(name="Cohere Command Small", provider="cohere", id="command-small", api="chat"),
        LMModel(name="Cohere Command Light", provider="cohere", id="command-light", api="chat"),
    ]


    LM_MODELS = LM_MODELS_ZEN + LM_MODELS_SMALL

    model_options = {m.name: m for m in LM_MODELS}
    return LM_MODELS, model_options


@app.cell
def _(model_options):
    model_options
    return


@app.cell
def _():
    return


if __name__ == "__main__":
    app.run()
