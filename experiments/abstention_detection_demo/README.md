# Abstention Detection Demos

> Abstention is an LLM's refusal — or failure — to answer a question. 

LLMs often provide a text response to the user without answering the question
the user asked, with an apology, or requesting a clarification, or by
explaining why it can't perform a particular action. These can be hard to
detect. 

Abstention is not inherently good or bad; the interpretation depends on
context. A positive intepretation might be the model is refusing the answer
a malicious query. A negative interpretation might be an inability for the
LLM to answer when it should be able to. 

Product teams want to detect abstention to help understand, evaluate and
improve the LLM systems. 

This experiment looks at different ways to detect abstention. We will start
with two approaches: 
* stop word detection: A simple approach that just detects for the presence
  of certain trigger words. 
* the Wang method using a fine-tuned model.  

## Setup

The notebook can be run locally or viewed on molab

The molab notebook URL is: 
https://molab.marimo.io/notebooks/nb_dXAb6U3PGLiUnGfyMLMgqk

To run the notebook locally, these are the requirements: 

- uv (main) will handle dependencies
- marimo (for the notebook)
- The big dependencies are: transformer, torch  

The notebook can be run with CPU only. GPU is faster. 

### Install & Run

```bash
# Replace with actual commands
uvx marimo edit --sandbox wang_method_abstention_detection.py
```

## Results and Learnings 

Each notebook as a documentation markdown file with details. 

For the Wang Method, see `documentation_wang_method.md`. The tldr is: 

* The Wang fine-tuned model `LibrAI/longformer-action-ro` has limitations
    * it  was trained on safety refusals and doesn't do as well with other
      abstains, such as **capability limitations**. 
    * The model loses reliability on non-English input
* GNW cannot use this model as-is

### Next steps to explore

- Benchmark any candidate approach against Zeno's current stop word technique
- Search for alternative models with broader abstention coverage
- Evaluate whether an LLM-as-judge prompt could cover the missing categories
- Benchmark any candidate approach against Zeno's current stop word technique

