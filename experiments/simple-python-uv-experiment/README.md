# Simple Python UV experiment

> **Paused (2026-07-20):** this served its purpose as a self-contained uv + marimo
> walkthrough of the repo mechanics. Unpause (or archive) if a new single-file
> Python experiment needs a starting point.

## Overview
This experiment is a self-contained experiment with one data file, one python file.
* utilizes `uv` with dependencies stated inline
* The experiment can be run with one user command.
* The data file is a CSV file

This is kept as a worked reference, not as a starting point — scaffold new marimo work from
`.github/templates/marimo/` via `just new-experiment <slug> marimo` instead. See the
recommendations in [brief.md](./brief.md).

## How to run this experiment

Prerequisites
* `uv` must be installed. That's it.

Setup:
* clone the repository and navigate to this experiment's folder

Run:
```
uvx marimo edit --sandbox experiment_one.py
```

This command will open a browser window to a **marimo** notebook, which provides an interface to the experiment as well as the code itself.

## Purpose

Helps understand and iterate on the github repo of experiments.
