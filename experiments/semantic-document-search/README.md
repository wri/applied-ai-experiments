# Semantic Document Search

> See [brief.md](./brief.md) for context, signals, and findings.

## Setup

### Prerequisites

- Node.js 24+, pnpm (run `pnpm install` at the repo root — this demo is part of the workspace)
- Embeddings run locally via transformers.js. A WebGPU-capable browser is recommended (there's a WASM fallback); the light models are a 23–33 MB one-time download, EmbeddingGemma-300M is ~300 MB behind an explicit opt-in.

### Install & Run

```bash
# from repo root
pnpm install

cd experiments/semantic-document-search/demo
pnpm dev      # http://localhost:5173
pnpm check    # svelte-check, strict
pnpm build    # static build → demo/dist/
```

Start with an example document (two real WRI technical notes, each with suggested queries) or drop in your own PDF. Note the examples are fetched cross-origin from `files.wri.org` rather than bundled — see the brief's recommendations.

## How it works

Text is extracted with pdfjs-dist, chunked by the selected strategy, and embedded in batches inside a Web Worker that **owns** the embeddings. Search embeds the query once per model and ranks chunks by cosine similarity. Two decisions shape the whole app:

- **The worker keys each retrieval set on `(document, model, strategy, options)`** and LRU-caches six of them. Switching back to a configuration you've already used is free, which is what makes side-by-side comparison affordable.
- **Embedding starts the moment text is extracted.** Page thumbnails render on the main thread in parallel and stream in — they aren't needed to search, so search never waits on them.

Retrieval quality is reported without ground truth: the quality panel shows top raw cosine, the gap to the runner-up, score spread, timings and backend, and `interpretMetrics()` turns those into a plain-language signal check. A **BM25 lexical baseline** is wired as the default second variant in compare mode, so semantic-vs-keyword is one click away.

### Models

Six entries in `lib/embeddings/models.ts`, a deliberately **pure-data** registry (no transformers.js import, so the UI can read model metadata without pulling in the ML runtime).

| Model | Dims | Size | Notes |
|---|---|---|---|
| MiniLM-L6-v2 | 384 | 23 MB | Tiny and fast; speed baseline |
| **GTE Small** (default) | 384 | 33 MB | Good quality/size balance for English |
| BGE Small EN v1.5 | 384 | 32 MB | Strong English retrieval; **query prefix** |
| mxbai Embed XSmall | 384 | 30 MB | WebGPU-tuned |
| Arctic Embed S | 384 | 33 MB | Multilingual; **query prefix** |
| EmbeddingGemma 300M | 768 | ~300 MB | Multilingual, best quality; **query + document prefixes**, Matryoshka dims, opt-in |
| BM25 | — | — | Lexical baseline (sentinel id, no model download) |

**Prompt prefixes are per-model data, applied by role at embed time.** BGE and Arctic want a query-side instruction prefix; EmbeddingGemma wants asymmetric query *and* document prefixes.

### Chunking

Four pluggable strategies under `lib/embeddings/chunkers/`, each with adjustable parameters: **paragraph** (default), **sentence-window**, **fixed-size with overlap**, and **whole-page**. Strategy changes what's retrievable more than swapping between two similarly-sized models does, so it's treated as a first-class variable with its own comparison rather than a tuning detail.

## What's in here

```
├── demo/src/
│   ├── routes/
│   │   ├── +layout.svelte           # Shell + theme (imports @wri-datalab/ui/styles)
│   │   ├── +layout.js               # prerender = true, ssr = false
│   │   └── +page.svelte             # The whole UX: status machine over the document store
│   └── lib/
│       ├── components/              # 22 components + index.ts
│       │   ├── DocumentInput/ExampleDocPicker      # File drop, URL, curated examples
│       │   ├── ProcessingStatus                    # Parallel document + model progress
│       │   ├── ConfigBar/ModelPicker/ChunkingPicker/SliderParam
│       │   ├── ResultsView                         # Tabbed heatmap | passages | charts
│       │   ├── ThumbnailGrid/PageThumbnail/ChunkHeatmap/HeatmapLegend
│       │   ├── PassageResults/PassageItem          # Ranked list w/ term highlighting
│       │   ├── ScoreChart/PlotContainer            # Observable Plot, SSR-safe
│       │   ├── QualitySummary                      # Ground-truth-free quality signals
│       │   ├── PageDetail/DocHeader
│       │   └── ComparisonView/ConfigPicker         # Side-by-side (model, strategy) configs
│       ├── embeddings/
│       │   ├── models.ts            # Pure-data model registry + embeddingSetKey()
│       │   ├── model.ts             # Pipeline loading, prefix application by role
│       │   ├── worker.ts            # Owns retrieval sets; LRU cache; batch embedding
│       │   ├── search.ts            # Cosine similarity ranking
│       │   ├── bm25.ts              # Okapi BM25 lexical baseline
│       │   ├── metrics.ts           # Quality signals + interpretMetrics()
│       │   ├── device.ts            # WebGPU detection (awaits requestAdapter)
│       │   └── chunkers/            # paragraph | sentence-window | fixed | page
│       ├── pdf/
│       │   ├── parser.ts            # Text extraction via pdfjs-dist
│       │   └── renderer.ts          # Page thumbnail rendering
│       ├── data/examples.ts         # Curated WRI PDFs + suggested queries
│       ├── stores/                  # document | config | search | comparison
│       └── types/index.ts           # Shared worker/UI contract (Zod)
└── brief.md
```

## References

- [transformers.js (Hugging Face)](https://huggingface.co/docs/transformers.js)
- [Xenova/gte-small (default model)](https://huggingface.co/Xenova/gte-small)
- [onnx-community/embeddinggemma-300m-ONNX](https://huggingface.co/onnx-community/embeddinggemma-300m-ONNX)
- [pdfjs-dist](https://mozilla.github.io/pdf.js/)
