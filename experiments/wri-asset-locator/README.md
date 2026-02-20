# WRI Asset locator

Fetches information about various WRI assets (currently datasets) and displays them visually in a 2d projection for a user to search and explore. 

## Idea garden reference

This experiment has an Asana entry: 
https://app.asana.com/1/25496124013636/project/1210050417738685/task/1211762347149448?focus=true

Originating idea from Evan:
Asana: https://app.asana.com/1/25496124013636/project/1210050417738685/task/1210826187134586?focus=true

## Purpose

**Purpose: Provide a simple way for user to find relevant datasets and link to where it can be viewed/downloaded.**

Compare to the WRI Dataset Explorer -- this is more lightweight, more inclusive of assets. Provides only basic information about the selected asset, and a link. 


## Approach

There is documentation built into the main notebook
`asset_locator.py`

Experiment Methodology Steps: 
* Fetches a list of assets and metadata from various sources, such as ResourceWatch. 
* Flattens all descriptions and information into a text string per asset. 
* Embeds the text string in a high-dimensional space using a transformer, then back down to a 2-dim space. 
* Enable a search query which is embedded with the same transfomer, can compute distances to each asset
* Create a simple UI and visualization


## What's in here

```
├── src/            # Fetch scripts (marimo notebooks)
├── notebooks/      # Analysis notebooks
├── data/           # Generated CSV data files
└── exports/        # HTML exports
```

**Fetch scripts** (in `src/`):
- `src/fetch_datasets_arcgis_wri_catalog.py` : fetch datasets from the ARCGIS catalog
- `src/fetch_datasets_global_forest_watch.py` : fetch datasets from Global Forest Watch API
- `src/fetch_datasets_resource_watch_datasets.py` : fetch datasets from the Resource Watch API
- `src/fetch_datasets_scrape_pdfreport_energy_access_explorer.py` : fetch dataset info about EAE from the methodology report
- `src/fetch_datasets_wri_data_explorer.py` : fetch datasets from the WRI Data Explorer
- `src/combine_assets_data.py` : combine all individual CSV files into unified dataset
- `src/fetch_all.py` : convenience script to run all fetch notebooks and data combination

**Main notebook** (in `notebooks/`):
- `notebooks/asset_locator.py` : loads combined data, creates embeddings, and visualizes

## How to run the experiment

### Prerequisites
* `uv` must be installed
* Other dependencies are handled by `uv` via PEP 723 metadata

### Note on GPUs
* Embedding is done locally, which requires computation
* GPU(s) used if available
* If no GPU available, CPU(s) will be used (~10 minutes for 650 assets)
* Some caching is utilized with marimo's persistent cache feature

### First Time Setup

#### Option 1: Quick Start (Recommended)
Run all fetch scripts and combine data at once:
```bash
python src/fetch_all.py
```
This will fetch all source data and create `wri_assets_info_combined.csv`.

#### Option 2: Run Each Fetch Script Individually
```bash
uv run marimo edit src/fetch_datasets_arcgis_wri_catalog.py
uv run marimo edit src/fetch_datasets_global_forest_watch.py
uv run marimo edit src/fetch_datasets_resource_watch_datasets.py
uv run marimo edit src/fetch_datasets_scrape_pdfreport_energy_access_explorer.py
uv run marimo edit src/fetch_datasets_wri_data_explorer.py
```

### Running the Main Notebook
Once data files are generated (including `wri_assets_info_combined.csv`):
```bash
uv run marimo edit notebooks/asset_locator.py
```

The notebook will check for the combined data file and show instructions if it's missing.

### Subsequent Runs
* Fetch scripts don't need to be run again unless you want fresh data
* The main notebook will use cached embeddings when possible 


## Decisions & Learnings Log

Use this as a lightweight log of important decisions and learnings.
– Decision or learning, and why it matters.
- Another note.

## Future Work
- What we'd do next if this experiment shows promise.
- How this could roll into a product, tool, or broader system.
- Follow-up experiments or variations to explore.

## Results

_Summary of findings once the experiment is complete. Link to [brief.md](./brief.md) for the full write-up._
