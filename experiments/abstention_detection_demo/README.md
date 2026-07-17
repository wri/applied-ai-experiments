# {Experiment Title}

> One to three sentences on what this does and what it produces. See [brief.md](./brief.md) for the full context and findings.

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

