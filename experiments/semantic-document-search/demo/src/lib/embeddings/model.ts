import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';
import type { Chunk, Device, Dtype, ModelProgressPayload } from '../types';
import { getModel } from './models';
import { pickDtype } from './device';

// Browser caching is enabled by default (models cached in the Cache API after
// first download). Allow fetching models from the HF Hub.
env.allowRemoteModels = true;

// One cached pipeline per model id, plus the backend/dtype it actually loaded
// with (which may differ from what was requested if WebGPU fell back to WASM).
const pipelines = new Map<string, FeatureExtractionPipeline>();
const deviceUsed = new Map<string, Device>();
const dtypeUsed = new Map<string, Dtype>();

const DEFAULT_BATCH_SIZE = 16;

export type ProgressCallback = (progress: ModelProgressPayload) => void;

export interface LoadOptions {
	device?: Device;
	dtype?: Dtype;
	onProgress?: ProgressCallback;
}

export interface LoadResult {
	device: Device;
	dtype: Dtype;
	loadMs: number;
}

function wrapProgress(modelId: string, onProgress?: ProgressCallback) {
	return (progress: {
		status: string;
		progress?: number;
		file?: string;
		loaded?: number;
		total?: number;
	}) => {
		onProgress?.({
			modelId,
			status: progress.status,
			progress: progress.progress ?? 0,
			file: progress.file,
			loaded: progress.loaded,
			total: progress.total
		});
	};
}

/**
 * Load (or return the cached) embedding pipeline for a model. Attempts the
 * requested device and falls back to WASM if WebGPU construction fails,
 * reporting the device actually used.
 */
export async function loadModel(modelId: string, opts: LoadOptions = {}): Promise<LoadResult> {
	const cached = pipelines.get(modelId);
	if (cached) {
		return { device: deviceUsed.get(modelId)!, dtype: dtypeUsed.get(modelId)!, loadMs: 0 };
	}

	const model = getModel(modelId);
	let device: Device = opts.device ?? 'wasm';
	let dtype: Dtype = opts.dtype ?? pickDtype(model, device);

	const start = performance.now();
	let pipe: FeatureExtractionPipeline;
	try {
		pipe = await pipeline('feature-extraction', modelId, {
			device,
			dtype,
			progress_callback: wrapProgress(modelId, opts.onProgress)
		});
	} catch (err) {
		// WebGPU may be advertised but fail at construction — fall back to WASM.
		if (device === 'webgpu') {
			device = 'wasm';
			dtype = opts.dtype ?? pickDtype(model, 'wasm');
			pipe = await pipeline('feature-extraction', modelId, {
				device,
				dtype,
				progress_callback: wrapProgress(modelId, opts.onProgress)
			});
		} else {
			throw err;
		}
	}

	const loadMs = performance.now() - start;
	pipelines.set(modelId, pipe);
	deviceUsed.set(modelId, device);
	dtypeUsed.set(modelId, dtype);
	return { device, dtype, loadMs };
}

export function isModelLoaded(modelId: string): boolean {
	return pipelines.has(modelId);
}

function getPipeline(modelId: string): FeatureExtractionPipeline {
	const pipe = pipelines.get(modelId);
	if (!pipe) throw new Error(`Model not loaded: ${modelId}. Call loadModel() first.`);
	return pipe;
}

// Apply the model's asymmetric prompt prefix for the given role. Several models
// (BGE, Arctic, EmbeddingGemma) retrieve poorly without these.
function withPrefix(modelId: string, text: string, role: 'query' | 'document'): string {
	const model = getModel(modelId);
	const prefix = role === 'query' ? model.queryPrefix : model.documentPrefix;
	return prefix ? prefix + text : text;
}

/**
 * Embed a single text (typically a query).
 */
export async function embed(
	modelId: string,
	text: string,
	role: 'query' | 'document'
): Promise<number[]> {
	const pipe = getPipeline(modelId);
	const output = await pipe(withPrefix(modelId, text, role), {
		pooling: 'mean',
		normalize: true
	});
	return Array.from(output.data as Float32Array);
}

/**
 * Embed chunks in batches (array input to the pipeline), applying the document
 * prefix. Falls back to single-item embedding if a batch fails.
 */
export async function embedChunks(
	modelId: string,
	chunks: Chunk[],
	opts: { batchSize?: number; onProgress?: (completed: number, total: number) => void } = {}
): Promise<{ chunks: Chunk[]; embedMs: number }> {
	const pipe = getPipeline(modelId);
	const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;
	const embedded: Chunk[] = [];
	const start = performance.now();

	for (let i = 0; i < chunks.length; i += batchSize) {
		const batch = chunks.slice(i, i + batchSize);
		const texts = batch.map((c) => withPrefix(modelId, c.text, 'document'));

		let vectors: number[][];
		try {
			const output = await pipe(texts, { pooling: 'mean', normalize: true });
			const data = output.data as Float32Array;
			const dims = output.dims as number[];
			const hidden = dims[dims.length - 1];
			vectors = batch.map((_, j) => Array.from(data.slice(j * hidden, (j + 1) * hidden)));
		} catch {
			// Defensive: some models choke on batching — embed one at a time.
			vectors = [];
			for (const c of batch) {
				const output = await pipe(withPrefix(modelId, c.text, 'document'), {
					pooling: 'mean',
					normalize: true
				});
				vectors.push(Array.from(output.data as Float32Array));
			}
		}

		batch.forEach((c, j) => embedded.push({ ...c, embedding: vectors[j] }));
		opts.onProgress?.(embedded.length, chunks.length);
	}

	return { chunks: embedded, embedMs: performance.now() - start };
}
