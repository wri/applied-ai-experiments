import { loadModel, embed, embedChunks } from './model';
import { chunk } from './chunkers';
import { search } from './search';
import { computeSearchMetrics } from './metrics';
import { detectDevice } from './device';
import { getModel } from './models';
import { isBm25, buildBm25Index, bm25Search, type Bm25Index } from './bm25';
import type {
	WorkerMessage,
	WorkerMessageType,
	LoadModelPayload,
	BuildSetPayload,
	SearchPayload,
	EvictSetPayload,
	ModelProgressPayload,
	Chunk,
	ChunkResult,
	ChunkStripItem,
	ChunkStrategyId,
	ChunkOptions,
	BuildMetrics,
	Device,
	PerKeySearchResult
} from '../types';

// The worker owns all embeddings (and BM25 indexes). The main thread holds only
// page text and thumbnails for display; search runs here against cached sets.
interface RetrievalSet {
	key: string;
	modelId: string;
	strategyId: ChunkStrategyId;
	options: ChunkOptions;
	kind: 'embedding' | 'bm25';
	dims: number;
	chunks: Chunk[]; // with embeddings for 'embedding' sets
	bm25Index?: Bm25Index; // for 'bm25' sets
	buildMetrics: BuildMetrics;
}

// Sequential chunk strip (document order) shared by both retrieval methods.
function buildStrip(allChunkResults: ChunkResult[]): ChunkStripItem[] {
	return allChunkResults
		.slice()
		.sort(
			(a, b) =>
				a.chunk.pageNumber - b.chunk.pageNumber || a.chunk.indexInPage - b.chunk.indexInPage
		)
		.map((r) => ({
			pageNumber: r.chunk.pageNumber,
			similarity: r.similarity,
			preview: r.chunk.text.length > 100 ? r.chunk.text.slice(0, 100) + '…' : r.chunk.text
		}));
}

// LRU cache of embedding sets (insertion order = recency). Caps memory when
// comparing several (model, strategy) configurations.
const MAX_SETS = 6;
const sets = new Map<string, RetrievalSet>();

let devicePromise: Promise<Device> | null = null;
function getDevice(): Promise<Device> {
	if (!devicePromise) devicePromise = detectDevice();
	return devicePromise;
}

function touch(key: string): void {
	const set = sets.get(key);
	if (set) {
		sets.delete(key);
		sets.set(key, set);
	}
}

function evictIfNeeded(): void {
	while (sets.size > MAX_SETS) {
		const oldest = sets.keys().next().value;
		if (oldest === undefined) break;
		sets.delete(oldest);
	}
}

function post(type: WorkerMessageType, payload?: unknown): void {
	self.postMessage({ type, payload });
}

function errMessage(e: unknown): string {
	return e instanceof Error ? e.message : 'Unknown error';
}

// Ensure a model is loaded on the detected device, reporting the backend used.
async function ensureModel(modelId: string) {
	const device = await getDevice();
	const result = await loadModel(modelId, {
		device,
		onProgress: (p: ModelProgressPayload) => post('MODEL_PROGRESS', p)
	});
	post('MODEL_READY', {
		modelId,
		device: result.device,
		dtype: result.dtype,
		loadMs: result.loadMs
	});
	return result;
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
	const { type, payload } = event.data;

	switch (type) {
		case 'LOAD_MODEL': {
			const { modelId } = payload as LoadModelPayload;
			try {
				await ensureModel(modelId);
			} catch (error) {
				post('MODEL_ERROR', { modelId, message: errMessage(error) });
			}
			break;
		}

		case 'BUILD_SET': {
			const { key, modelId, strategyId, options, pages } = payload as BuildSetPayload;
			try {
				// Already built — return instantly (this is what makes switching
				// back to a previous config free).
				const existing = sets.get(key);
				if (existing) {
					touch(key);
					post('SET_READY', {
						key,
						modelId,
						strategyId,
						chunkCount: existing.chunks.length,
						buildMetrics: existing.buildMetrics
					});
					break;
				}

				// BM25 baseline: chunk + build a lexical index. No model, no embeddings.
				if (isBm25(modelId)) {
					post('BUILD_PROGRESS', { key, phase: 'chunking', completed: 0, total: pages.length });
					const bmChunks: Chunk[] = [];
					for (let i = 0; i < pages.length; i++) {
						const p = pages[i];
						bmChunks.push(...chunk(strategyId, p.text, p.pageNumber, options));
						post('BUILD_PROGRESS', { key, phase: 'chunking', completed: i + 1, total: pages.length });
					}
					const t0 = performance.now();
					const bm25Index = buildBm25Index(bmChunks);
					const buildMetrics: BuildMetrics = {
						chunkCount: bmChunks.length,
						embedMs: performance.now() - t0, // index build time
						loadMs: 0,
						device: 'wasm',
						dtype: 'q8'
					};
					sets.set(key, {
						key,
						modelId,
						strategyId,
						options,
						kind: 'bm25',
						dims: 0,
						chunks: bmChunks,
						bm25Index,
						buildMetrics
					});
					evictIfNeeded();
					post('SET_READY', { key, modelId, strategyId, chunkCount: bmChunks.length, buildMetrics });
					break;
				}

				const load = await ensureModel(modelId);

				// Chunk every page with the chosen strategy.
				post('BUILD_PROGRESS', { key, phase: 'chunking', completed: 0, total: pages.length });
				const allChunks: Chunk[] = [];
				for (let i = 0; i < pages.length; i++) {
					const p = pages[i];
					allChunks.push(...chunk(strategyId, p.text, p.pageNumber, options));
					post('BUILD_PROGRESS', { key, phase: 'chunking', completed: i + 1, total: pages.length });
				}

				// Embed all chunks (batched).
				const { chunks: embedded, embedMs } = await embedChunks(modelId, allChunks, {
					onProgress: (completed, total) =>
						post('BUILD_PROGRESS', { key, phase: 'embedding', completed, total })
				});

				const buildMetrics: BuildMetrics = {
					chunkCount: embedded.length,
					embedMs,
					loadMs: load.loadMs,
					device: load.device,
					dtype: load.dtype
				};

				sets.set(key, {
					key,
					modelId,
					strategyId,
					options,
					kind: 'embedding',
					dims: getModel(modelId).dims,
					chunks: embedded,
					buildMetrics
				});
				evictIfNeeded();

				post('SET_READY', {
					key,
					modelId,
					strategyId,
					chunkCount: embedded.length,
					buildMetrics
				});
			} catch (error) {
				post('MODEL_ERROR', { key, modelId, message: errMessage(error) });
			}
			break;
		}

		case 'SEARCH': {
			const { queryId, query, keys, topK } = payload as SearchPayload;
			try {
				const perKey: Record<string, PerKeySearchResult> = {};

				// Group keys by model so the query is embedded once per model.
				const byModel = new Map<string, string[]>();
				for (const key of keys) {
					const set = sets.get(key);
					if (!set) continue;
					const arr = byModel.get(set.modelId) ?? [];
					arr.push(key);
					byModel.set(set.modelId, arr);
				}

				for (const [modelId, modelKeys] of byModel) {
					// BM25 keys: lexical scoring, no query embedding.
					if (isBm25(modelId)) {
						for (const key of modelKeys) {
							const set = sets.get(key)!;
							touch(key);
							const sStart = performance.now();
							const { results, rawChunkResults, allChunkResults } = bm25Search(
								set.bm25Index!,
								query,
								topK ?? 50
							);
							const searchMs = performance.now() - sStart;
							const metrics = computeSearchMetrics(
								rawChunkResults,
								{ queryEmbedMs: 0, searchMs },
								{ chunkCount: set.chunks.length, modelLoadMs: 0, dims: 0 }
							);
							perKey[key] = {
								results,
								rawChunkResults,
								metrics,
								chunkStrip: buildStrip(allChunkResults)
							};
						}
						continue;
					}

					const qStart = performance.now();
					const queryEmbedding = await embed(modelId, query, 'query');
					const queryEmbedMs = performance.now() - qStart;

					for (const key of modelKeys) {
						const set = sets.get(key)!;
						touch(key);
						const sStart = performance.now();
						const { results, rawChunkResults, allChunkResults } = search(
							set.chunks,
							queryEmbedding,
							topK ?? 50
						);
						const searchMs = performance.now() - sStart;
						const metrics = computeSearchMetrics(
							rawChunkResults,
							{ queryEmbedMs, searchMs },
							{ chunkCount: set.chunks.length, modelLoadMs: set.buildMetrics.loadMs, dims: set.dims }
						);
						perKey[key] = {
							results,
							rawChunkResults,
							metrics,
							chunkStrip: buildStrip(allChunkResults)
						};
					}
				}

				post('SEARCH_RESULTS', { queryId, perKey });
			} catch (error) {
				post('MODEL_ERROR', { message: errMessage(error) });
			}
			break;
		}

		case 'EVICT_SET': {
			const { key } = payload as EvictSetPayload;
			sets.delete(key);
			break;
		}

		default:
			console.warn('Unknown worker message type:', type);
	}
};

// Signal the worker is alive.
post('WORKER_READY');
