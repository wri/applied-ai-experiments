import type { Chunk, ChunkResult, SearchOutput } from '../types';
import { aggregateToPages, normalizeScores } from './search';
import { getModel } from './models';

// BM25 lexical retrieval — a classic keyword baseline to contrast against
// semantic (embedding) search. No model, no download; scores are TF-IDF with
// length normalization. Used only in the compare view.

const K1 = 1.5;
const B = 0.75;

export const BM25_MODEL_ID = 'bm25';

export const BM25_BASELINE = {
	id: BM25_MODEL_ID,
	label: 'BM25 (keyword)',
	note: 'Classic keyword baseline — TF-IDF term matching, no embeddings or download.'
};

export function isBm25(modelId: string): boolean {
	return modelId === BM25_MODEL_ID;
}

// Display label that tolerates the BM25 sentinel (getModel throws on it).
export function modelDisplayLabel(modelId: string): string {
	return isBm25(modelId) ? BM25_BASELINE.label : getModel(modelId).label;
}

export function tokenize(text: string): string[] {
	return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 1);
}

export interface Bm25Index {
	chunks: Chunk[];
	tf: Map<string, number>[]; // per chunk: term -> count
	lengths: number[];
	avgdl: number;
	idf: Map<string, number>;
}

export function buildBm25Index(chunks: Chunk[]): Bm25Index {
	const tf: Map<string, number>[] = [];
	const lengths: number[] = [];
	const df = new Map<string, number>();

	for (const c of chunks) {
		const tokens = tokenize(c.text);
		lengths.push(tokens.length);
		const counts = new Map<string, number>();
		for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
		tf.push(counts);
		for (const term of counts.keys()) df.set(term, (df.get(term) ?? 0) + 1);
	}

	const n = chunks.length;
	const avgdl = n ? lengths.reduce((a, b) => a + b, 0) / n : 0;
	const idf = new Map<string, number>();
	// Always-positive idf variant: ln(1 + (N - df + 0.5) / (df + 0.5))
	for (const [term, d] of df) idf.set(term, Math.log(1 + (n - d + 0.5) / (d + 0.5)));

	return { chunks, tf, lengths, avgdl, idf };
}

/**
 * Score the query against the index. Returns the same shape as semantic
 * `search()`. BM25 scores are unbounded, so they're scaled to [0, 1] (relative
 * to the top match) to keep downstream percentage display and heatmaps sane —
 * the scale differs from cosine, so compare which passages rank highest, not
 * raw magnitudes.
 */
export function bm25Search(index: Bm25Index, query: string, topChunks = 50): SearchOutput {
	const qTerms = [...new Set(tokenize(query))];

	const scored: ChunkResult[] = index.chunks.map((chunk, i) => {
		const counts = index.tf[i];
		const len = index.lengths[i];
		let score = 0;
		for (const term of qTerms) {
			const f = counts.get(term);
			if (!f) continue;
			const idf = index.idf.get(term) ?? 0;
			const denom = f + K1 * (1 - B + (B * len) / (index.avgdl || 1));
			score += idf * ((f * (K1 + 1)) / denom);
		}
		return { chunk, similarity: score };
	});

	const maxScore = scored.reduce((m, r) => Math.max(m, r.similarity), 0);
	const allChunkResults: ChunkResult[] = scored.map((r) => ({
		chunk: r.chunk,
		similarity: maxScore > 0 ? r.similarity / maxScore : 0
	}));

	const rawChunkResults = allChunkResults
		.slice()
		.sort((a, b) => b.similarity - a.similarity)
		.slice(0, topChunks);

	const pageResults = aggregateToPages(rawChunkResults);
	return { results: normalizeScores(pageResults), rawChunkResults, allChunkResults };
}
