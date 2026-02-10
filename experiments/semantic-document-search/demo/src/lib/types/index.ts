import { z } from 'zod';

// Chunk represents a text segment from a document page
export const ChunkSchema = z.object({
	id: z.string(),
	text: z.string(),
	pageNumber: z.number().int().positive(),
	indexInPage: z.number().int().nonnegative(),
	embedding: z.array(z.number()).optional()
});

export type Chunk = z.infer<typeof ChunkSchema>;

// Page represents a single PDF page with its content and visual data
export const PageSchema = z.object({
	pageNumber: z.number().int().positive(),
	width: z.number().positive(),
	height: z.number().positive(),
	thumbnail: z.string().optional(), // base64 data URL
	text: z.string(),
	chunks: z.array(ChunkSchema)
});

export type Page = z.infer<typeof PageSchema>;

// Document processing status
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

// DocumentState represents the full state of a loaded document
export const DocumentStateSchema = z.object({
	filename: z.string().nullable(),
	pageCount: z.number().int().nonnegative(),
	pages: z.array(PageSchema),
	status: DocumentStatusSchema,
	progress: z.number().min(0).max(100),
	error: z.string().nullable()
});

export type DocumentState = z.infer<typeof DocumentStateSchema>;

// ChunkResult represents a matched chunk with its similarity score
export const ChunkResultSchema = z.object({
	chunk: ChunkSchema,
	similarity: z.number().min(0).max(1)
});

export type ChunkResult = z.infer<typeof ChunkResultSchema>;

// SearchResult represents page-level search results
export const SearchResultSchema = z.object({
	pageNumber: z.number().int().positive(),
	score: z.number().min(0).max(1),
	chunks: z.array(ChunkResultSchema)
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

// Model loading status
export const ModelStatusSchema = z.enum([
	'idle',
	'loading',
	'ready',
	'error'
]);

export type ModelStatus = z.infer<typeof ModelStatusSchema>;

// Worker message types for typed communication
export type WorkerMessageType =
	| 'LOAD_MODEL'
	| 'MODEL_PROGRESS'
	| 'MODEL_READY'
	| 'MODEL_ERROR'
	| 'EMBED_CHUNKS'
	| 'EMBED_PROGRESS'
	| 'CHUNKS_EMBEDDED'
	| 'EMBED_QUERY'
	| 'QUERY_EMBEDDED';

export interface WorkerMessage {
	type: WorkerMessageType;
	payload?: unknown;
}

export interface ModelProgressPayload {
	status: string;
	progress: number;
	file?: string;
	loaded?: number;
	total?: number;
}

export interface EmbedChunksPayload {
	chunks: Chunk[];
}

export interface EmbedProgressPayload {
	completed: number;
	total: number;
}

export interface ChunksEmbeddedPayload {
	chunks: Chunk[];
}

export interface EmbedQueryPayload {
	query: string;
}

export interface QueryEmbeddedPayload {
	embedding: number[];
}
