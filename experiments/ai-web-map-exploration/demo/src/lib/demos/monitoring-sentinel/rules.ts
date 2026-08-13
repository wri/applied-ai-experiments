/**
 * Sentinel rule machinery. The LLM's only job is parsing the watch sentence
 * into a machine-checkable rule; everything after that — the simulated flood
 * growth, metric evaluation, near-miss detection — is pure code over the
 * (modelled) Zambezi data, so every alert is reproducible and auditable.
 */

import type { Schema } from '$lib/llm/types';

export type WatchMetric = 'farms_touched' | 'sites_high_exposure' | 'extent_area_km2';
export type WatchOp = '>' | '>=' | '<' | '<=';

export interface WatchRule {
	metric: WatchMetric;
	op: WatchOp;
	threshold: number;
	label: string;
}

export const WATCH_SCHEMA: Schema = {
	type: 'object',
	required: ['metric', 'op', 'threshold', 'label'],
	additionalProperties: false,
	properties: {
		metric: { enum: ['farms_touched', 'sites_high_exposure', 'extent_area_km2'] },
		op: { enum: ['>', '>=', '<', '<='] },
		threshold: { type: 'number' },
		label: { type: 'string', maxLength: 80 }
	}
};

export const METRIC_LABELS: Record<WatchMetric, string> = {
	farms_touched: 'farm sites inside extent',
	sites_high_exposure: 'high-exposure sites inside extent',
	extent_area_km2: 'modelled extent area (km²)'
};

export const SIM_DAYS = 30;

/**
 * Scripted flood-growth curve, expressed as "how many of the N farm sites the
 * extent touches on day t". Non-monotonic BY DESIGN: it climbs to a near-miss
 * around day 16 (~98 sites against the canonical 100-site watch), recedes —
 * the false-alarm moment every alerting design has to answer for — then grows
 * decisively past the threshold. Interpolated against the actual sorted
 * distances, so it holds for any regeneration of the farm data.
 */
const COUNT_ANCHORS: [day: number, frac: number][] = [
	[0, 0.09],
	[6, 0.28],
	[11, 0.45],
	[14, 0.53],
	[16, 0.57], // near-miss peak (×172 farms ≈ 98)
	[19, 0.5], // recession
	[22, 0.61], // crosses 100
	[26, 0.71],
	[30, 0.81]
];

export function touchedFraction(day: number): number {
	const t = Math.max(0, Math.min(SIM_DAYS, day));
	for (let i = 0; i < COUNT_ANCHORS.length - 1; i++) {
		const [d0, f0] = COUNT_ANCHORS[i];
		const [d1, f1] = COUNT_ANCHORS[i + 1];
		if (t >= d0 && t <= d1) return f0 + ((t - d0) / (d1 - d0)) * (f1 - f0);
	}
	return COUNT_ANCHORS.at(-1)![1];
}

export interface FarmSite {
	id: string;
	name: string;
	lngLat: [number, number];
	dist_river_m: number;
	flood_exposure: string;
	households: number;
}

/** Distance threshold (m from river) the extent reaches on a given day. */
export function thresholdAt(day: number, sortedDistances: number[]): number {
	const n = sortedDistances.length;
	const count = Math.round(touchedFraction(day) * n);
	if (count <= 0) return sortedDistances[0] - 1;
	return sortedDistances[Math.min(count, n) - 1];
}

export interface Metrics {
	day: number;
	thresholdM: number;
	farms_touched: number;
	sites_high_exposure: number;
	extent_area_km2: number;
	touched: FarmSite[];
}

/** ~river centerline length of the modelled reach (for the area proxy). */
const REACH_KM = 230;

export function computeMetrics(day: number, farms: FarmSite[], sortedDistances: number[]): Metrics {
	const thresholdM = thresholdAt(day, sortedDistances);
	const touched = farms.filter((f) => f.dist_river_m <= thresholdM);
	return {
		day,
		thresholdM,
		farms_touched: touched.length,
		sites_high_exposure: touched.filter((f) => f.flood_exposure === 'high').length,
		extent_area_km2: Math.round(((2 * thresholdM) / 1000) * REACH_KM),
		touched
	};
}

export function ruleValue(rule: WatchRule, m: Metrics): number {
	return m[rule.metric];
}

export function ruleFires(rule: WatchRule, value: number): boolean {
	switch (rule.op) {
		case '>':
			return value > rule.threshold;
		case '>=':
			return value >= rule.threshold;
		case '<':
			return value < rule.threshold;
		case '<=':
			return value <= rule.threshold;
	}
}

/** Within 5% of the threshold (on the trigger side's approach) but not firing. */
export function ruleNear(rule: WatchRule, value: number): boolean {
	if (ruleFires(rule, value)) return false;
	const margin = Math.abs(rule.threshold) * 0.05 || 2;
	return Math.abs(value - rule.threshold) <= margin;
}

export function describeRule(rule: WatchRule): string {
	return `${METRIC_LABELS[rule.metric]} ${rule.op} ${rule.threshold}`;
}
