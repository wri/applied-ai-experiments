import type {
	SearchResult,
	ChunkResult,
	ChunkStripItem,
	SearchMetrics,
	ModelStatus
} from '../types';

export interface SearchState {
	query: string;
	results: SearchResult[];
	rawChunkResults: ChunkResult[];
	chunkStrip: ChunkStripItem[];
	metrics: SearchMetrics | null;
	modelStatus: ModelStatus;
	modelProgress: number;
	modelProgressMessage: string;
	isSearching: boolean;
	selectedPage: number | null;
}

export function createInitialSearchState(): SearchState {
	return {
		query: '',
		results: [],
		rawChunkResults: [],
		chunkStrip: [],
		metrics: null,
		modelStatus: 'idle',
		modelProgress: 0,
		modelProgressMessage: '',
		isSearching: false,
		selectedPage: null
	};
}

export function setSearchQuery(state: SearchState, query: string): SearchState {
	return { ...state, query };
}

export function setSearchResults(
	state: SearchState,
	results: SearchResult[],
	rawChunkResults: ChunkResult[],
	chunkStrip: ChunkStripItem[],
	metrics: SearchMetrics
): SearchState {
	return { ...state, results, rawChunkResults, chunkStrip, metrics, isSearching: false };
}

export function setSearching(state: SearchState, isSearching: boolean): SearchState {
	return { ...state, isSearching };
}

export function setModelStatus(
	state: SearchState,
	status: ModelStatus,
	progress: number = 0,
	message: string = ''
): SearchState {
	return { ...state, modelStatus: status, modelProgress: progress, modelProgressMessage: message };
}

export function setSelectedPage(state: SearchState, pageNumber: number | null): SearchState {
	return { ...state, selectedPage: pageNumber };
}

// Clear results but keep the loaded model status (used when the query empties).
export function clearSearchResults(state: SearchState): SearchState {
	return {
		...state,
		query: '',
		results: [],
		rawChunkResults: [],
		chunkStrip: [],
		metrics: null,
		isSearching: false,
		selectedPage: null
	};
}

export function resetSearchState(): SearchState {
	return createInitialSearchState();
}

export function getPageScore(state: SearchState, pageNumber: number): number {
	const result = state.results.find((r) => r.pageNumber === pageNumber);
	return result?.score ?? 0;
}

export function getTopPages(state: SearchState, n: number = 3): number[] {
	return state.results.slice(0, n).map((r) => r.pageNumber);
}

export function isTopResult(state: SearchState, pageNumber: number, n: number = 3): boolean {
	return getTopPages(state, n).includes(pageNumber);
}
