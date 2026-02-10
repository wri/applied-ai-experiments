import { loadModel, embed, embedChunks, isModelLoaded } from './model';
import type {
	WorkerMessage,
	ModelProgressPayload,
	EmbedChunksPayload,
	EmbedProgressPayload,
	ChunksEmbeddedPayload,
	EmbedQueryPayload,
	QueryEmbeddedPayload,
	Chunk
} from '../types';

/**
 * Send a typed message back to the main thread
 */
function postMessage(type: WorkerMessage['type'], payload?: unknown) {
	self.postMessage({ type, payload });
}

/**
 * Handle incoming messages from the main thread
 */
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
	const { type, payload } = event.data;

	switch (type) {
		case 'LOAD_MODEL': {
			try {
				await loadModel((progress: ModelProgressPayload) => {
					postMessage('MODEL_PROGRESS', progress);
				});
				postMessage('MODEL_READY');
			} catch (error) {
				postMessage('MODEL_ERROR', {
					message: error instanceof Error ? error.message : 'Unknown error'
				});
			}
			break;
		}

		case 'EMBED_CHUNKS': {
			try {
				const { chunks } = payload as EmbedChunksPayload;

				// Ensure model is loaded
				if (!isModelLoaded()) {
					await loadModel((progress: ModelProgressPayload) => {
						postMessage('MODEL_PROGRESS', progress);
					});
					postMessage('MODEL_READY');
				}

				const embeddedChunks = await embedChunks(
					chunks,
					(completed: number, total: number) => {
						const progress: EmbedProgressPayload = { completed, total };
						postMessage('EMBED_PROGRESS', progress);
					}
				);

				const result: ChunksEmbeddedPayload = { chunks: embeddedChunks };
				postMessage('CHUNKS_EMBEDDED', result);
			} catch (error) {
				postMessage('MODEL_ERROR', {
					message: error instanceof Error ? error.message : 'Unknown error'
				});
			}
			break;
		}

		case 'EMBED_QUERY': {
			try {
				const { query } = payload as EmbedQueryPayload;

				// Ensure model is loaded
				if (!isModelLoaded()) {
					await loadModel((progress: ModelProgressPayload) => {
						postMessage('MODEL_PROGRESS', progress);
					});
					postMessage('MODEL_READY');
				}

				const embedding = await embed(query);
				const result: QueryEmbeddedPayload = { embedding };
				postMessage('QUERY_EMBEDDED', result);
			} catch (error) {
				postMessage('MODEL_ERROR', {
					message: error instanceof Error ? error.message : 'Unknown error'
				});
			}
			break;
		}

		default:
			console.warn('Unknown message type:', type);
	}
};

// Signal that the worker is ready
postMessage('MODEL_PROGRESS', { status: 'worker_ready', progress: 0 });
