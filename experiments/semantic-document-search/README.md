# Semantic Document Search

> Client-side semantic search tool for PDF documents using browser-based embeddings. Upload a PDF, search by meaning, and see relevant pages highlighted in a visual heatmap — all without sending data to a server. See [brief.md](./brief.md) for the full context and findings.

## Setup

### Prerequisites

- Node.js 24+
- pnpm

### Install & Run

```bash
cd demo
pnpm install
pnpm dev
# Open http://localhost:5173
```

## What's in here

```
├── demo/src/
│   ├── routes/
│   │   ├── +layout.svelte              # App layout and theme
│   │   └── +page.svelte                # Main application page
│   └── lib/
│       ├── components/                  # UI components
│       │   ├── DocumentInput.svelte     # File upload / URL input
│       │   ├── SearchBar.svelte         # Query input
│       │   ├── ThumbnailGrid.svelte     # Page grid with  heatmap
│       │   ├── PageThumbnail.svelte     # Individual page thumbnail
│       │   ├── PageDetail.svelte        # Expanded page view
│       │   └── ProcessingStatus.svelte  # Loading/progress indicator
│       ├── embeddings/                  # ML and search logic
│       │   ├── model.ts                 # Model loading via transformers.js
│       │   ├── chunker.ts              # Text chunking for embeddings
│       │   ├── search.ts               # Cosine similarity search
│       │   └── worker.ts               # Web Worker for background processing
│       ├── pdf/                        # PDF handling
│       │   ├── parser.ts               # Text extraction via pdfjs-dist
│       │   └── renderer.ts             # Page thumbnail rendering
│       ├── stores/                     # State
│       └── types/                      # TS types with Zod schemas
├── brief.md
└── info.yaml
```

## Decisions & Learnings Log

- Selected gte-small model for balance of quality vs size (~30MB).
- Using Web Worker to keep UI responsive during embedding generation.
- transformers.js runs the embedding model entirely in-browser; pdfjs-dist handles PDF parsing.

## Future Work

- Test with various PDF sizes to find practical limits on different hardware
- Gather user feedback on heatmap and drill-down UX
- Compare approach to traditional ranked results, BM25, etc.  
- Transformers.js 4.x is in preview and may boast performance improvements

## Results

_Summary of findings once the experiment is complete. Link to [brief.md](./brief.md) for the full write-up._
