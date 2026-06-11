import type { ChunkResult, SearchMetrics } from '../types';

const DEFAULT_THRESHOLD = 0.5;

/**
 * Compute search-quality signals over RAW cosine similarities (no ground
 * truth). These describe how confident/distinctive a match is and how fast the
 * search ran — surfaced in the quality panel.
 *
 * @param rawChunkResults top-K chunk results, sorted descending by similarity
 */
export function computeSearchMetrics(
	rawChunkResults: ChunkResult[],
	timing: { queryEmbedMs: number; searchMs: number },
	ctx: { chunkCount: number; modelLoadMs: number; dims: number; threshold?: number }
): SearchMetrics {
	const scores = rawChunkResults.map((r) => r.similarity);
	const n = scores.length;
	const threshold = ctx.threshold ?? DEFAULT_THRESHOLD;

	const rawTopScore = n > 0 ? scores[0] : 0;
	const scoreGapTop12 = n >= 2 ? scores[0] - scores[1] : rawTopScore;

	const mean = n > 0 ? scores.reduce((a, b) => a + b, 0) / n : 0;
	// scores are sorted desc, but median by index works regardless of order
	const median =
		n === 0 ? 0 : n % 2 === 1 ? scores[(n - 1) / 2] : (scores[n / 2 - 1] + scores[n / 2]) / 2;
	const variance = n > 0 ? scores.reduce((a, b) => a + (b - mean) ** 2, 0) / n : 0;
	const std = Math.sqrt(variance);

	const countAboveThreshold = scores.filter((s) => s >= threshold).length;

	return {
		rawTopScore,
		rawScores: scores,
		scoreGapTop12,
		meanTopK: mean,
		medianTopK: median,
		stdTopK: std,
		countAboveThreshold,
		threshold,
		queryEmbedMs: timing.queryEmbedMs,
		searchMs: timing.searchMs,
		chunkCount: ctx.chunkCount,
		modelLoadMs: ctx.modelLoadMs,
		dims: ctx.dims
	};
}

/**
 * A plain-language verdict derived from the metrics. Raw cosine numbers mean
 * little to most users — this is the highest-value explainer in the UI.
 */
export function interpretMetrics(m: SearchMetrics): { label: string; sentiment: 'good' | 'ok' | 'poor' } {
	if (m.chunkCount === 0 || m.rawScores.length === 0) {
		return { label: 'No content to search yet.', sentiment: 'poor' };
	}
	if (m.rawTopScore >= 0.55 && m.scoreGapTop12 >= 0.05) {
		return {
			label: 'Strong top match with a clear gap — likely a confident hit.',
			sentiment: 'good'
		};
	}
	if (m.rawTopScore >= 0.4 && m.countAboveThreshold >= 1) {
		return {
			label: 'Reasonable matches, but several passages score similarly — skim the top few.',
			sentiment: 'ok'
		};
	}
	return {
		label: 'Scores are clustered and low — the document may not cover this; try rephrasing.',
		sentiment: 'poor'
	};
}
