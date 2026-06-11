import type { ChunkOptions, ChunkStrategyId, Dtype } from '../types';

// Pure-data model registry. No transformers.js import, so both the worker and
// the UI can import it cheaply (the UI must not pull in the ML runtime).

export interface ModelEntry {
	id: string; // Hugging Face repo id, e.g. 'Xenova/gte-small'
	label: string; // short UI label
	dims: number; // embedding dimensionality
	approxSizeMB: number; // download size (for the picker)
	multilingual: boolean;
	webgpuDtype: Dtype;
	wasmDtype: Dtype;
	// Some models need asymmetric prompt prefixes for good retrieval. Applied
	// by role in embed()/embedChunks(); omitting them tanks retrieval quality.
	queryPrefix?: string;
	documentPrefix?: string;
	matryoshkaDims?: number[]; // MRL truncation options (e.g. EmbeddingGemma)
	heavy?: boolean; // large download — gate behind an explicit opt-in
	notes?: string; // surfaced in the picker
	default?: boolean;
}

export const MODEL_REGISTRY: ModelEntry[] = [
	{
		id: 'Xenova/all-MiniLM-L6-v2',
		label: 'MiniLM-L6-v2',
		dims: 384,
		approxSizeMB: 23,
		multilingual: false,
		webgpuDtype: 'fp32',
		wasmDtype: 'q8',
		notes: 'Tiny & fast. A solid speed baseline.'
	},
	{
		id: 'Xenova/gte-small',
		label: 'GTE Small',
		dims: 384,
		approxSizeMB: 33,
		multilingual: false,
		webgpuDtype: 'fp32',
		wasmDtype: 'q8',
		default: true,
		notes: 'Good quality/size balance for English.'
	},
	{
		id: 'Xenova/bge-small-en-v1.5',
		label: 'BGE Small EN v1.5',
		dims: 384,
		approxSizeMB: 32,
		multilingual: false,
		webgpuDtype: 'fp32',
		wasmDtype: 'q8',
		queryPrefix: 'Represent this sentence for searching relevant passages: ',
		notes: 'Strong English retrieval. Uses a query prefix.'
	},
	{
		id: 'mixedbread-ai/mxbai-embed-xsmall-v1',
		label: 'mxbai Embed XSmall',
		dims: 384,
		approxSizeMB: 30,
		multilingual: false,
		webgpuDtype: 'fp32',
		wasmDtype: 'q8',
		notes: 'WebGPU-tuned; fast on supported GPUs.'
	},
	{
		id: 'Snowflake/snowflake-arctic-embed-s',
		label: 'Arctic Embed S',
		dims: 384,
		approxSizeMB: 33,
		multilingual: true,
		webgpuDtype: 'fp32',
		wasmDtype: 'q8',
		queryPrefix: 'Represent this sentence for searching relevant passages: ',
		notes: 'Multilingual. Uses a query prefix.'
	},
	{
		id: 'onnx-community/embeddinggemma-300m-ONNX',
		label: 'EmbeddingGemma 300M',
		dims: 768,
		approxSizeMB: 300,
		multilingual: true,
		webgpuDtype: 'fp32',
		wasmDtype: 'q4',
		queryPrefix: 'task: search result | query: ',
		documentPrefix: 'title: none | text: ',
		matryoshkaDims: [768, 512, 256, 128],
		heavy: true,
		notes: '~300MB download. Best-in-class multilingual quality; runs best on WebGPU.'
	}
];

export const DEFAULT_MODEL_ID =
	MODEL_REGISTRY.find((m) => m.default)?.id ?? MODEL_REGISTRY[0].id;

export function getModel(id: string): ModelEntry {
	const entry = MODEL_REGISTRY.find((m) => m.id === id);
	if (!entry) {
		throw new Error(`Unknown model id: ${id}`);
	}
	return entry;
}

// --- embedding-set keying ---------------------------------------------------

// Stable, order-independent hash of chunk options so the same config always
// produces the same key (used to cache/dedupe embedding sets).
function optionsHash(options: ChunkOptions): string {
	const parts = Object.entries(options)
		.filter(([, v]) => v !== undefined && v !== null)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([k, v]) => `${k}=${v}`);
	return parts.join(',');
}

// Keyed by document instance too, so two different PDFs sharing a config don't
// collide in the worker-side cache.
export function embeddingSetKey(
	docId: string,
	modelId: string,
	strategyId: ChunkStrategyId,
	options: ChunkOptions
): string {
	return `${docId}::${modelId}::${strategyId}::${optionsHash(options)}`;
}
