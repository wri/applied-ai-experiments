import type { SearchResult, ModelStatus } from '../types';

export interface SearchState {
	query: string;
	results: SearchResult[];
	modelStatus: ModelStatus;
	modelProgress: number;
	modelProgressMessage: string;
	isSearching: boolean;
	selectedPage: number | null;
}

/**
 * Create initial search state
 */
export function createInitialSearchState(): SearchState {
	return {
		query: '',
		results: [],
		modelStatus: 'idle',
		modelProgress: 0,
		modelProgressMessage: '',
		isSearching: false,
		selectedPage: null
	};
}

/**
 * Set search query
 */
export function setSearchQuery(state: SearchState, query: string): SearchState {
	return {
		...state,
		query
	};
}

/**
 * Set search results
 */
export function setSearchResults(state: SearchState, results: SearchResult[]): SearchState {
	return {
		...state,
		results,
		isSearching: false
	};
}

/**
 * Set searching state
 */
export function setSearching(state: SearchState, isSearching: boolean): SearchState {
	return {
		...state,
		isSearching
	};
}

/**
 * Set model status
 */
export function setModelStatus(
	state: SearchState,
	status: ModelStatus,
	progress: number = 0,
	message: string = ''
): SearchState {
	return {
		...state,
		modelStatus: status,
		modelProgress: progress,
		modelProgressMessage: message
	};
}

/**
 * Set selected page for detail view
 */
export function setSelectedPage(state: SearchState, pageNumber: number | null): SearchState {
	return {
		...state,
		selectedPage: pageNumber
	};
}

/**
 * Clear search results
 */
export function clearSearchResults(state: SearchState): SearchState {
	return {
		...state,
		query: '',
		results: [],
		isSearching: false,
		selectedPage: null
	};
}

/**
 * Reset search state
 */
export function resetSearchState(): SearchState {
	return createInitialSearchState();
}

/**
 * Get score for a specific page
 */
export function getPageScore(state: SearchState, pageNumber: number): number {
	const result = state.results.find((r) => r.pageNumber === pageNumber);
	return result?.score ?? 0;
}

/**
 * Get top N page numbers by score
 */
export function getTopPages(state: SearchState, n: number = 3): number[] {
	return state.results
		.slice(0, n)
		.map((r) => r.pageNumber);
}

/**
 * Check if a page is in top N results
 */
export function isTopResult(state: SearchState, pageNumber: number, n: number = 3): boolean {
	return getTopPages(state, n).includes(pageNumber);
}
