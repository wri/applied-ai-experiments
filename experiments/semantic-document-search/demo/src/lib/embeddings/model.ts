import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';
import type { Chunk, ModelProgressPayload } from '../types';

// Configure transformers.js
// Browser caching is enabled by default (useBrowserCache = true)
// Models are cached in the browser's Cache API after first download
env.allowRemoteModels = true;

const MODEL_NAME = 'Xenova/gte-small';

let embeddingPipeline: FeatureExtractionPipeline | null = null;

export type ProgressCallback = (progress: ModelProgressPayload) => void;

/**
 * Load the embedding model with progress reporting
 * Model is cached in the browser after first download (~33MB)
 */
export async function loadModel(onProgress?: ProgressCallback): Promise<void> {
	if (embeddingPipeline) {
		return; // Already loaded
	}

	onProgress?.({
		status: 'loading',
		progress: 0,
		file: 'model'
	});

	// @ts-expect-error - transformers.js has complex union types that TypeScript can't fully infer
	embeddingPipeline = await pipeline('feature-extraction', MODEL_NAME, {
		progress_callback: (progress: {
			status: string;
			progress?: number;
			file?: string;
			loaded?: number;
			total?: number;
		}) => {
			onProgress?.({
				status: progress.status,
				progress: progress.progress ?? 0,
				file: progress.file,
				loaded: progress.loaded,
				total: progress.total
			});
		}
	});

	onProgress?.({
		status: 'ready',
		progress: 100
	});
}

/**
 * Check if model is loaded
 */
export function isModelLoaded(): boolean {
	return embeddingPipeline !== null;
}

/**
 * Generate embedding for a single text
 */
export async function embed(text: string): Promise<number[]> {
	if (!embeddingPipeline) {
		throw new Error('Model not loaded. Call loadModel() first.');
	}

	const output = await embeddingPipeline(text, {
		pooling: 'mean',
		normalize: true
	});

	// Convert tensor to array
	return Array.from(output.data as Float32Array);
}

/**
 * Generate embeddings for multiple texts with progress
 */
export async function embedBatch(
	texts: string[],
	onProgress?: (completed: number, total: number) => void
): Promise<number[][]> {
	const embeddings: number[][] = [];

	for (let i = 0; i < texts.length; i++) {
		const embedding = await embed(texts[i]);
		embeddings.push(embedding);
		onProgress?.(i + 1, texts.length);
	}

	return embeddings;
}

/**
 * Add embeddings to chunks
 */
export async function embedChunks(
	chunks: Chunk[],
	onProgress?: (completed: number, total: number) => void
): Promise<Chunk[]> {
	const embeddedChunks: Chunk[] = [];

	for (let i = 0; i < chunks.length; i++) {
		const embedding = await embed(chunks[i].text);
		embeddedChunks.push({
			...chunks[i],
			embedding
		});
		onProgress?.(i + 1, chunks.length);
	}

	return embeddedChunks;
}
