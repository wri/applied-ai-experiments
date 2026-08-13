---
# ---- Required ----
title: "Semantic Document Search"
type: prototype
status: done

# ---- Recommended ----
created_at: 2026-01-20
updated_at: 2026-06-25

# ---- Classification ----
targets: infra
themes:
  - reliability
  - patterns
tags:
  - semantic-search
  - transformers.js

# ---- Demo ----
demo:
  enabled: true
  type: sveltekit
  build_command: "pnpm build"
  output_dir: "demo/dist"
---

# Semantic Document Search

> Client-side semantic search tool for PDF documents using browser-based embeddings. Load a PDF (or an example), search by meaning, and explore relevance as a page heatmap, ranked passages, or score charts. Switch between embedding models, tune chunking strategies, and compare configurations side by side.

## Before

### What problem or question does this address?

Browser-based ML can run embedding models locally. This builds a privacy-preserving document search
where relevance is a visual map across the whole document. We're kicking the tires on a few libraries and models to see whether client-side embeddings are practical on consumer hardware.

WRI teams work with long policy and science documents where the relevant content may sit in dense or domain-specific language. Ctrl + F "deforestation drivers" won't keyword-match "land-use conversion pressures." transformers.js has matured enough to run embedding models client-side, so we're looking at semantic search without server infrastructure.

Primary theme: **reliability**. The question is whether a simple client-side retrieval setup is plausibly capable of delvering a good retrieval experience for common use cases.

### What does this experiment actually do?

Upload or fetch a PDF → extract text with pdfjs-dist → embed chunks with Xenova/gte-small via transformers.js in a Web Worker → search by cosine similarity → visualize relevance as a heatmap over page thumbnails → click a page to see the matched paragraphs.

### What signals are we looking for?

- Client-side embeddings are practical on consumer hardware: a small model loads and embeds a ~20-page report fast enough that search feels interactive, on WebGPU or plain WASM.
- Semantic retrieval surfaces passages a keyword search misses.
- Search also narrows the results enough to be useful.

### What are the boundaries?

- **Browser-only** — no server, no API keys; everything runs on the visitor's hardware.
- **Text PDFs only** — not planning on OCR for scanned documents.
- **Retrieval surface, not RAG** — ranking and visualization only; no answer generation, no hybrid fusion or reranking.
- **No labeled evaluation** — quality is read from ground-truth-free metrics and inspection, not precision/recall.

---

## Learnings

- Future note for embedding model bakeoffs: embedding models often expect different prompt prefixes (query-side instruction prefix, or document prefixes) so the prefix belongs in the model registry as per-model data and applied by role at embed time.
- BM25 lexical baseline alongside any semantic search surface helps to establish a reasonable comparison. Always be BM25ing.
- Chunking strategy seems to change retrieval quality more than swapping between two similarly-sized embedding models.
- Tooling moves very fast... transformers.js is a central piece of this experiment, and the library got a major update after the first draft was written.

---

## After

**Outcome:** Confirmed (capability): client-side embedding search is practical on ordinary hardware — six models from 23 to 300 MB run in a Web Worker over WebGPU with WASM fallback, and a config-keyed cache makes side-by-side comparison of models and chunking strategies cheap. Retrieval *quality* claims are impressionistic: would need to extend this experimentwith a labeled query set and do proper evals on quality to make any claims.

### Signal check

- **Practical on consumer hardware** — **Confirmed.** The 384-dim small models (23–33 MB) load in seconds and embed a ~20-page report quickly enough to feel interactive; fp32 on WebGPU with quantized WASM fallback covers devices without GPU access.
- **Semantic surfaces what keyword misses** — **Confirmed, anecdotally.** The BM25 baseline in compare mode shows the two methods ranking different passages on the example documents, and the vocabulary-mismatch cases behave as hoped. But nothing was measured; did not yet develop a small labeled query set for test documents.

### What happened?

A six-model registry with per-model prompt prefixes stored as data and applied by role, four pluggable chunking strategies with tunable parameters, a BM25 lexical baseline, and a compare mode running 2-4 configurations against the same document. Embeddings run in a web worker, keyed on (document, model, chunking, options) with a small LRU.

transformers.js shipped a major version (3 → 4) mid-experiment and the demo was migrated to the new version.

### What would you recommend?

- Adopt the pattern for demos and light internal tools: client-side embeddings are real, free to
  operate, and private by construction.
- Before anything product-shaped: add a small labeled eval set.

### What decisions and tradeoffs came up along the way?

- Per-model prompt prefixes live in the registry.
- BM25 as a comparison variant.
- Example documents are fetched cross-origin from files.wri.org rather than bundled - we might sometimes CORS a lil.
- Many loose ends left as-is: Matryoshka dims are declared and sketched out but truncation was not attempted, top-K and the relevance threshold are hardcoded.
