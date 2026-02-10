import type { Chunk, SearchResult, ChunkResult } from '../types';

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length) {
		throw new Error('Vectors must have the same length');
	}

	let dotProduct = 0;
	let normA = 0;
	let normB = 0;

	for (let i = 0; i < a.length; i++) {
		dotProduct += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}

	const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
	return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Search chunks by similarity to a query embedding
 */
export function searchChunks(
	chunks: Chunk[],
	queryEmbedding: number[],
	topK: number = 10
): ChunkResult[] {
	const results: ChunkResult[] = chunks
		.filter((chunk) => chunk.embedding)
		.map((chunk) => ({
			chunk,
			similarity: cosineSimilarity(chunk.embedding!, queryEmbedding)
		}))
		.sort((a, b) => b.similarity - a.similarity)
		.slice(0, topK);

	return results;
}

/**
 * Aggregate chunk results to page-level scores
 * Uses max similarity per page
 */
export function aggregateToPages(chunkResults: ChunkResult[]): SearchResult[] {
	const pageMap = new Map<number, ChunkResult[]>();

	// Group chunks by page
	for (const result of chunkResults) {
		const pageNumber = result.chunk.pageNumber;
		if (!pageMap.has(pageNumber)) {
			pageMap.set(pageNumber, []);
		}
		pageMap.get(pageNumber)!.push(result);
	}

	// Calculate page scores (max similarity)
	const pageResults: SearchResult[] = [];
	for (const [pageNumber, chunks] of pageMap) {
		const maxScore = Math.max(...chunks.map((c) => c.similarity));
		pageResults.push({
			pageNumber,
			score: maxScore,
			chunks: chunks.sort((a, b) => b.similarity - a.similarity)
		});
	}

	return pageResults.sort((a, b) => b.score - a.score);
}

/**
 * Normalize scores to 0-1 range based on min/max in results
 */
export function normalizeScores(results: SearchResult[]): SearchResult[] {
	if (results.length === 0) return results;

	const scores = results.map((r) => r.score);
	const minScore = Math.min(...scores);
	const maxScore = Math.max(...scores);
	const range = maxScore - minScore;

	if (range === 0) {
		// All scores are the same, set to 1
		return results.map((r) => ({ ...r, score: 1 }));
	}

	return results.map((r) => ({
		...r,
		score: (r.score - minScore) / range
	}));
}

/**
 * Get page scores as a map for easy lookup
 */
export function getPageScoreMap(results: SearchResult[]): Map<number, number> {
	const map = new Map<number, number>();
	for (const result of results) {
		map.set(result.pageNumber, result.score);
	}
	return map;
}

/**
 * Full search pipeline: find similar chunks and aggregate to pages
 */
export function search(
	chunks: Chunk[],
	queryEmbedding: number[],
	topChunks: number = 50
): SearchResult[] {
	const chunkResults = searchChunks(chunks, queryEmbedding, topChunks);
	const pageResults = aggregateToPages(chunkResults);
	return normalizeScores(pageResults);
}
