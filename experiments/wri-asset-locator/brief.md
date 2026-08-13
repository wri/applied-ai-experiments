---
# ---- Required ----
title: "WRI Assets Locator"
type: marimo
status: done

# ---- Recommended ----
created_at: 2025-10-19
updated_at: 2026-04-29

# ---- Classification ----
targets: feature
themes:
  - prototyping

tags:
  - embedding
  - visualization

# ---- Demo (when there's something to show) ----
demo:
  enabled: false
---

# WRI Assets Locator

> Fetches information about various WRI assets (currently datasets) and displays them visually for a user to search and explore.

## Before

### What problem or question does this address?

Finding datasets, publications, and other WRI assets on a given topic is frustratingly difficult, and we've heard anecdotally that people don't know what exists or how to find it. This offers semantic search across several WRI platforms: it projects assets into a 2D map you can search and explore, and surfaces "similar" assets by proximity.

### What does this experiment actually do?

1. **Fetch** asset metadata from Resource Watch, WRI's ArcGIS catalog, Global Forest Watch, Energy Access Explorer, and WRI Data Explorer.
2. **Embed** each asset's metadata as a high-dimensional vector. The hard part: that metadata is inconsistent and many fields are missing.
3. **Project** to 2D with UMAP, which tries to preserve proximity — so nearby points are similar assets.
4. **Explore** in a notebook: navigate the visualization, make selections, and enter a search term to highlight relevant assets.

### What signals are we looking for?

This is one of many possible approaches to the discovery problem, so the signal we want is contact with real users. We want to hear from you if:

- you found assets you didn't know about;
- you wish it had more assets, or a specific asset type your team needs;
- you find the concept interesting at all;
- it gave you an idea for a completely different way to locate WRI assets.

### What are the boundaries?

- **Few sources**, some possibly noisy or outdated.
- **Datasets only.** The methodology is deliberately asset-type-agnostic, but ingestion currently covers datasets — not knowledge products, blog posts, or anything else.
- **Embedding and search are unrefined.** Cleaning and filtering the per-asset metadata is the obvious next lever.
- **The UI is an interactive Altair chart in a notebook**, not a designed interface. A real implementation would need substantial usability work.

---

## Learnings

- There may be quick approaches to making WRI assets more findable.
- This experiment was effective without using generative LLM models — it instead uses transformers and embeddings.

---

## After

**Outcome:** Confirmed: it is feasible to usefully navigate many WRI assets without requiring
existing curation.
