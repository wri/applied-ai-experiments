import type { DocumentState, DocumentStatus, Page, Chunk } from '../types';

/**
 * Create initial document state
 */
export function createInitialDocumentState(): DocumentState {
	return {
		filename: null,
		pageCount: 0,
		pages: [],
		status: 'idle',
		progress: 0,
		error: null
	};
}

/**
 * Update document status
 */
export function setDocumentStatus(
	state: DocumentState,
	status: DocumentStatus,
	progress: number = 0
): DocumentState {
	return {
		...state,
		status,
		progress,
		error: null
	};
}

/**
 * Set document error
 */
export function setDocumentError(state: DocumentState, error: string): DocumentState {
	return {
		...state,
		status: 'error',
		error
	};
}

/**
 * Set document pages after parsing
 */
export function setDocumentPages(
	state: DocumentState,
	filename: string,
	pages: Page[]
): DocumentState {
	return {
		...state,
		filename,
		pageCount: pages.length,
		pages,
		status: 'extracting',
		progress: 0,
		error: null
	};
}

/**
 * Update page thumbnails
 */
export function setPageThumbnail(
	state: DocumentState,
	pageNumber: number,
	thumbnail: string
): DocumentState {
	return {
		...state,
		pages: state.pages.map((page) =>
			page.pageNumber === pageNumber ? { ...page, thumbnail } : page
		)
	};
}

/**
 * Update chunks with embeddings
 */
export function setChunksWithEmbeddings(
	state: DocumentState,
	embeddedChunks: Chunk[]
): DocumentState {
	// Create a map of chunk id to embedded chunk
	const chunkMap = new Map<string, Chunk>();
	for (const chunk of embeddedChunks) {
		chunkMap.set(chunk.id, chunk);
	}

	// Update pages with embedded chunks
	const updatedPages = state.pages.map((page) => ({
		...page,
		chunks: page.chunks.map((chunk) => chunkMap.get(chunk.id) ?? chunk)
	}));

	return {
		...state,
		pages: updatedPages,
		status: 'ready',
		progress: 100
	};
}

/**
 * Get all chunks from document state
 */
export function getAllChunksFromState(state: DocumentState): Chunk[] {
	return state.pages.flatMap((page) => page.chunks);
}

/**
 * Reset document state
 */
export function resetDocumentState(): DocumentState {
	return createInitialDocumentState();
}
