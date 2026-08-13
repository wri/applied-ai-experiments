/**
 * Anomaly detection in code — the model explains, it never detects. Two
 * signals per point, each z-scored within its own category: change_score
 * (unusual activity) and distance from the category's embedding centroid
 * (unusual character). The rank key is the max of the two.
 */

import type { Schema } from '$lib/llm/types';

export interface Candidate {
	id: string;
	name: string;
	category: string;
	coords: [number, number];
	changeScore: number;
	/** z of change_score vs the category's mean/sd */
	changeZ: number;
	/** distance from the category centroid in (ex, ey) embedding space */
	embedDist: number;
	/** z of embedDist vs the category's mean/sd */
	embedZ: number;
	/** rank key: max(changeZ, embedZ) */
	combined: number;
}

type Bounds = [[number, number], [number, number]];

interface Pt {
	id: string;
	name: string;
	category: string;
	coords: [number, number];
	change: number;
	ex: number;
	ey: number;
}

function stats(values: number[]): { mean: number; sd: number } {
	const mean = values.reduce((a, b) => a + b, 0) / values.length;
	const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
	return { mean, sd: Math.sqrt(variance) || 1e-9 };
}

/**
 * Top candidates by combined z-score, restricted to the viewport bounds.
 * Falls back to the whole dataset when fewer than `minInView` points are in
 * view (the caller surfaces that in the UI).
 */
export function computeCandidates(
	fc: GeoJSON.FeatureCollection,
	bounds: Bounds | null,
	top = 20,
	minInView = 8
): { candidates: Candidate[]; usedViewport: boolean } {
	const all: Pt[] = fc.features.flatMap((f) => {
		if (f.geometry.type !== 'Point') return [];
		const p = f.properties ?? {};
		return [
			{
				id: String(p.id),
				name: String(p.name),
				category: String(p.category),
				coords: f.geometry.coordinates as [number, number],
				change: Number(p.change_score),
				ex: Number(p.ex),
				ey: Number(p.ey)
			}
		];
	});

	const inView = bounds
		? all.filter(
				(p) =>
					p.coords[0] >= bounds[0][0] &&
					p.coords[0] <= bounds[1][0] &&
					p.coords[1] >= bounds[0][1] &&
					p.coords[1] <= bounds[1][1]
			)
		: all;
	const usedViewport = inView.length >= minInView;
	const pool = usedViewport ? inView : all;

	// per-category stats computed over the WHOLE dataset — the reference
	// population, not the (possibly tiny) slice in view
	const byCat = new Map<string, Pt[]>();
	for (const p of all) {
		const arr = byCat.get(p.category) ?? [];
		arr.push(p);
		byCat.set(p.category, arr);
	}
	const catStats = new Map<
		string,
		{ change: { mean: number; sd: number }; cx: number; cy: number; dist: { mean: number; sd: number } }
	>();
	for (const [cat, pts] of byCat) {
		const change = stats(pts.map((p) => p.change));
		const cx = pts.reduce((a, p) => a + p.ex, 0) / pts.length;
		const cy = pts.reduce((a, p) => a + p.ey, 0) / pts.length;
		const dist = stats(pts.map((p) => Math.hypot(p.ex - cx, p.ey - cy)));
		catStats.set(cat, { change, cx, cy, dist });
	}

	const candidates = pool
		.map((p): Candidate => {
			const s = catStats.get(p.category)!;
			const changeZ = (p.change - s.change.mean) / s.change.sd;
			const embedDist = Math.hypot(p.ex - s.cx, p.ey - s.cy);
			const embedZ = (embedDist - s.dist.mean) / s.dist.sd;
			return {
				id: p.id,
				name: p.name,
				category: p.category,
				coords: p.coords,
				changeScore: p.change,
				changeZ,
				embedDist,
				embedZ,
				combined: Math.max(changeZ, embedZ)
			};
		})
		.sort((a, b) => b.combined - a.combined)
		.slice(0, top);

	return { candidates, usedViewport };
}

/** One compact line per candidate for the model prompt. */
export function candidateTable(cands: Candidate[]): string {
	return cands
		.map(
			(c) =>
				`${c.id} | ${c.name} | ${c.category} | change=${c.changeScore.toFixed(2)} (z=${c.changeZ.toFixed(1)}) | embed_dist z=${c.embedZ.toFixed(1)}`
		)
		.join('\n');
}

export interface AnomalyStop {
	id: string;
	headline: string;
	why: string;
	confidence: 'high' | 'medium' | 'low';
}

export interface AnomalyResult {
	stops: AnomalyStop[];
}

/** Runtime schema: stop ids MUST be real candidate ids. */
export function buildAnomalySchema(ids: string[]): Schema {
	return {
		type: 'object',
		required: ['stops'],
		additionalProperties: false,
		properties: {
			stops: {
				type: 'array',
				minItems: 3,
				maxItems: 5,
				items: {
					type: 'object',
					required: ['id', 'headline', 'why', 'confidence'],
					additionalProperties: false,
					properties: {
						id: { enum: ids },
						headline: { type: 'string', maxLength: 80 },
						why: { type: 'string', maxLength: 300 },
						confidence: { enum: ['high', 'medium', 'low'] }
					}
				}
			}
		}
	};
}

export const ANOMALY_SYSTEM =
	'You are given pre-computed outlier candidates from a point dataset, with z-scores for two ' +
	'signals: change activity (change_score vs category peers) and embedding distance (how far ' +
	'the point sits from its category cluster). Pick the 5 most genuinely anomalous and explain ' +
	'each in one plain sentence a map user can verify, citing the numbers. Do not invent data.';
