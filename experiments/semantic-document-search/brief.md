# Semantic Document Search

> Browser-based ML can now run embedding models locally. This experiment uses that capability to build a privacy-preserving document search tool where relevance is shown as a visual map across the full document, testing how doc overviews compare with traditional ranked results for navigating long PDFs, and whether client-side embeddings are practical on consumer hardware.

## Before

### What problem or question does this address?

WRI researchers and internal teams regularly work with long policy and science documents where relevant content may use different terminology than a search query. Traditional keyword search misses semantically relevant content, a query about "deforestation drivers" might not find paragraphs discussing "land-use conversion pressures." Browser-based ML has matured enough (via transformers.js) to run embedding models client-side, which means we can build privacy-preserving semantic search without server infrastructure. This experiment tests whether that approach is practical on consumer hardware and whether it could be useful for WRI workflows.

### What does this experiment actually do?

1. **Upload** a PDF file or load from URL
2. **Extract** text from PDF pages using pdfjs-dist
3. **Embed** text chunks using Xenova/gte-small via transformers.js in a Web Worker
4. **Search** by meaning using cosine similarity
5. **Visualize** relevance across all pages as a heatmap overlay on page thumbnails
6. **Drill down** by clicking a heatmap page to reveal the matched paragraphs within it

No data leaves the browser. The embedding model (~30MB) downloads once and runs locally.

### What signals are we looking for?

**Success looks like:**
- 80%+ of top-3 results are relevant to the query meaning (qualitative assessment)
- Model loads in <30s, search responds in <500ms
- Users can identify relevant pages using the heatmap

**Failure looks like:**
- Model loading or inference is too slow to be practical on typical hardware
- Embedding quality is too low for domain-specific terminology
- Users find the heatmap confusing or unhelpful compared to a simple ranked list

**Qualitative criteria:**
- **Workflow comparison:** Do users find this faster or more useful than Ctrl+F / manual scanning for locating relevant content?
- **Discovery value:** Does the heatmap surface relevant pages users wouldn't have found through keyword search alone?

**Hypotheses:**
- **H1:** Client-side embedding models can generate useful semantic representations for document search with acceptable performance
- **H2:** Visual heatmap overlays on page thumbnails provide an intuitive way to understand search result relevance across a document

### What are the boundaries?

- **Scope:** Single-document semantic search with heatmap visualization
- **Time box:** Open-ended; runs until we learn what we need
- **Not doing:** Multi-document search, server-side processing, persistent storage of embeddings, OCR for scanned documents
- **Model choice:** Selected Xenova/gte-small primarily for download size (~30MB) — best balance of quality vs. browser-friendliness among available models
- **Visualization choice:** Considered a traditional ranked results list (loses document structure) and in-page text highlights (too granular for overview). Chose page-level heatmap to preserve the document's spatial structure and provide at-a-glance relevance scanning, with paragraph-level drill-down on click
- **Dependencies:** transformers.js (Xenova/gte-small model), pdfjs-dist
- **Constraints:** Browser memory limits for large PDFs (100+ pages), ~30MB model download on first use

---

## After

_Fill this section out when the experiment concludes or is stopped._

### What happened?

### What did you learn?

### What would you recommend?

### What decisions and tradeoffs came up along the way?
