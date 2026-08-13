import { z } from 'zod';

// ---------------------------------------------------------------------------
// Device & quantization
// ---------------------------------------------------------------------------

export type Device = 'webgpu' | 'wasm';
export type Dtype = 'fp32' | 'fp16' | 'q8' | 'q4' | 'q4f16';

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

export type ChunkStrategyId = 'paragraph' | 'fixed' | 'sentence-window' | 'page';

// Options for a chunking strategy. The meaning of `size`/`overlap` depends on
// the strategy (chars for paragraph/fixed, sentences for sentence-window).
export interface ChunkOptions {
	size?: number;
	overlap?: number;
	unit?: 'char' | 'token';
}

export const ChunkOptionsSchema = z.object({
	size: z.number().optional(),
	overlap: z.number().optional(),
	unit: z.enum(['char', 'token']).optional()
});

// ---------------------------------------------------------------------------
// Chunks & pages
// ---------------------------------------------------------------------------

// Chunk represents a text segment from a document page
export const ChunkSchema = z.object({
	id: z.string(),
	text: z.string(),
	pageNumber: z.number().int().positive(),
	indexInPage: z.number().int().nonnegative(),
	embedding: z.array(z.number()).optional()
});

export type Chunk = z.infer<typeof ChunkSchema>;

// Page represents a single PDF page. Chunks now live in worker-owned embedding
// sets (keyed by model + strategy), so the main-thread Page only carries the
// extracted text and the rendered thumbnail for display.
export const PageSchema = z.object({
	pageNumber: z.number().int().positive(),
	width: z.number().positive(),
	height: z.number().positive(),
	thumbnail: z.string().optional(), // base64 data URL
	text: z.string()
});

export type Page = z.infer<typeof PageSchema>;

// A lightweight {pageNumber, text} pair sent to the worker for chunking.
export interface PageText {
	pageNumber: number;
	text: string;
}

// ---------------------------------------------------------------------------
// Document state
// ---------------------------------------------------------------------------

export const DocumentStatusSchema = z.enum([
	'idle',
	'loading',
	'parsing',
	'extracting',
	'embedding',
	'ready',
	'error'
]);

export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const DocumentStateSchema = z.object({
	filename: z.string().nullable(),
	pageCount: z.number().int().nonnegative(),
	pages: z.array(PageSchema),
	status: DocumentStatusSchema,
	progress: z.number().min(0).max(100),
	error: z.string().nullable(),
	chunkCount: z.number().int().nonnegative()
});

export type DocumentState = z.infer<typeof DocumentStateSchema>;

// ---------------------------------------------------------------------------
// Search results
// ---------------------------------------------------------------------------

// ChunkResult is a matched chunk with its raw cosine similarity. Cosine over
// normalized embeddings lives in [-1, 1] — do NOT clamp to [0, 1] or raw
// (un-normalized) scores will fail validation.
export const ChunkResultSchema = z.object({
	chunk: ChunkSchema,
	similarity: z.number().min(-1).max(1)
});

export type ChunkResult = z.infer<typeof ChunkResultSchema>;

// SearchResult is a page-level result. `score` is min-max normalized to [0, 1]
// for the heatmap display; `chunks` carry raw similarities for drill-down.
export const SearchResultSchema = z.object({
	pageNumber: z.number().int().positive(),
	score: z.number().min(0).max(1),
	chunks: z.array(ChunkResultSchema)
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

// Quantitative search-quality signals computed over RAW cosine similarities
// (before normalization), surfaced to the quality panel. No ground truth.
export interface SearchMetrics {
	rawTopScore: number; // max raw cosine
	rawScores: number[]; // raw cosine of the top-K chunks (for the histogram)
	scoreGapTop12: number; // rawScores[0] - rawScores[1] (confidence margin)
	meanTopK: number;
	medianTopK: number;
	stdTopK: number;
	countAboveThreshold: number;
	threshold: number;
	queryEmbedMs: number;
	searchMs: number;
	chunkCount: number;
	modelLoadMs: number;
	dims: number;
}

export interface SearchOutput {
	results: SearchResult[]; // page-level, normalized
	rawChunkResults: ChunkResult[]; // raw cosine, sorted desc (top-K)
	allChunkResults: ChunkResult[]; // every scored chunk (for the sequential strip)
}

// One chunk in document order, for the sequential chunk-heatmap strip. Value is
// encoded in color + alt text, so only the score, page, and a short preview are
// carried (not full text).
export interface ChunkStripItem {
	pageNumber: number;
	similarity: number; // raw cosine
	preview: string; // short snippet for the alt text / tooltip
}

// ---------------------------------------------------------------------------
// Model status & build metrics
// ---------------------------------------------------------------------------

export const ModelStatusSchema = z.enum(['idle', 'loading', 'ready', 'error']);
export type ModelStatus = z.infer<typeof ModelStatusSchema>;

// Metrics captured when an embedding set is built (model load + embedding).
export interface BuildMetrics {
	chunkCount: number;
	embedMs: number;
	loadMs: number;
	device: Device;
	dtype: Dtype;
}

// ---------------------------------------------------------------------------
// Worker protocol
// ---------------------------------------------------------------------------

export type WorkerMessageType =
	// main -> worker
	| 'LOAD_MODEL'
	| 'BUILD_SET'
	| 'SEARCH'
	| 'EVICT_SET'
	// worker -> main
	| 'WORKER_READY'
	| 'MODEL_PROGRESS'
	| 'MODEL_READY'
	| 'MODEL_ERROR'
	| 'BUILD_PROGRESS'
	| 'SET_READY'
	| 'SEARCH_RESULTS';

export interface WorkerMessage {
	type: WorkerMessageType;
	payload?: unknown;
}

// --- main -> worker payloads ---

export interface LoadModelPayload {
	modelId: string;
	device?: Device;
}

export interface BuildSetPayload {
	key: string;
	modelId: string;
	strategyId: ChunkStrategyId;
	options: ChunkOptions;
	pages: PageText[];
	device?: Device;
}

export interface SearchPayload {
	queryId: number;
	query: string;
	keys: string[];
	topK?: number;
}

export interface EvictSetPayload {
	key: string;
}

// --- worker -> main payloads ---

export interface ModelProgressPayload {
	modelId?: string;
	status: string;
	progress: number;
	file?: string;
	loaded?: number;
	total?: number;
}

export interface ModelReadyPayload {
	modelId: string;
	device: Device;
	dtype: Dtype;
	loadMs: number;
}

export interface ModelErrorPayload {
	modelId?: string;
	key?: string;
	message: string;
}

export interface BuildProgressPayload {
	key: string;
	phase: 'chunking' | 'embedding';
	completed: number;
	total: number;
}

export interface SetReadyPayload {
	key: string;
	modelId: string;
	strategyId: ChunkStrategyId;
	chunkCount: number;
	buildMetrics: BuildMetrics;
}

export interface PerKeySearchResult {
	results: SearchResult[];
	rawChunkResults: ChunkResult[];
	metrics: SearchMetrics;
	chunkStrip: ChunkStripItem[];
}

export interface SearchResultsPayload {
	queryId: number;
	perKey: Record<string, PerKeySearchResult>;
}
