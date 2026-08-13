/**
 * Shared vocabulary for the water-risk probe suite (portfolio-copilot,
 * ensemble-explorer, why-this-score): indicator definitions, grouped weights,
 * score arithmetic, risk classes, ensemble helpers, and map expressions over
 * static/data/water-risk/basins.geojson.
 *
 * Two honesty layers in that file (see scripts/generate-data.ts):
 *   REAL     — sub-basin geometries and the 13 indicator scores come from a
 *              public global water-risk dataset (v4, 2023); -9999 means the
 *              real dataset has insufficient data (widespread for gtd here).
 *   MODELLED — the 5-model ensemble (bws_* / fut_*) is synthetic, anchored on
 *              each basin's real baseline; model names echo ISIMIP (H08,
 *              PCR-GLOBWB, WaterGAP2, CWatM, LPJmL). Aggregation weights in
 *              this module are demo defaults, not the official ones.
 */

import type { HoverLayerConfig } from '$lib/map/hover';

export const NO_DATA = -9999;

export type GroupId = 'quantity' | 'quality' | 'rrr';

export const GROUPS: Record<GroupId, { label: string; weight: number }> = {
	quantity: { label: 'Physical risk — quantity', weight: 0.5 },
	quality: { label: 'Physical risk — quality', weight: 0.25 },
	rrr: { label: 'Regulatory & reputational', weight: 0.25 }
};

export interface IndicatorProvenance {
	source: string;
	vintage: number;
	/** native resolution in meters (approx; drives the scale-of-use verdict) */
	resolutionM: number;
	resolutionLabel: string;
	method: 'modelled' | 'observed' | 'proxy';
	caveat: string;
}

export interface IndicatorDef {
	code: IndicatorCode;
	label: string;
	description: string;
	group: GroupId;
	/** within-group weight; each group's weights sum to 1 */
	weight: number;
	provenance: IndicatorProvenance;
}

export type IndicatorCode =
	| 'bws'
	| 'bwd'
	| 'gtd'
	| 'iav'
	| 'sev'
	| 'rfr'
	| 'cfr'
	| 'drr'
	| 'ucw'
	| 'cep'
	| 'udw'
	| 'usa'
	| 'rri';

export const INDICATORS: IndicatorDef[] = [
	{
		code: 'bws',
		label: 'Baseline water stress',
		description: 'Ratio of total water withdrawals to available renewable supply.',
		group: 'quantity',
		weight: 0.25,
		provenance: {
			source: 'Global hydrological model, v4 public dataset (REAL scores)',
			vintage: 2023,
			resolutionM: 9000,
			resolutionLabel: '5 arc-min (~9 km) inputs, sub-basin scores',
			method: 'modelled',
			caveat:
				'Long-term annual average — masks seasonal shortage. A single-model score today; the modelled ensemble overlay shows what a multi-model v5 could add.'
		}
	},
	{
		code: 'bwd',
		label: 'Water depletion',
		description: 'Fraction of renewable supply consumed rather than withdrawn and returned.',
		group: 'quantity',
		weight: 0.2,
		provenance: {
			source: 'Consumptive-use accounting, v4 public dataset (REAL scores)',
			vintage: 2023,
			resolutionM: 9000,
			resolutionLabel: '5 arc-min (~9 km)',
			method: 'modelled',
			caveat: 'Return-flow assumptions are sector-averaged; irrigation efficiency is not observed.'
		}
	},
	{
		code: 'gtd',
		label: 'Groundwater table decline',
		description: 'Long-term trend in shallow groundwater levels.',
		group: 'quantity',
		weight: 0.15,
		provenance: {
			source: 'Interpolated well observations, v4 public dataset (REAL scores)',
			vintage: 2023,
			resolutionM: 25000,
			resolutionLabel: 'well-network interpolation (~25 km)',
			method: 'observed',
			caveat:
				'Well coverage is sparse: in this delta extract gtd is -9999 for nearly every unit — the network cannot support a trend here. Insufficient data, NOT zero risk.'
		}
	},
	{
		code: 'iav',
		label: 'Interannual variability',
		description: 'Year-to-year variability of available supply.',
		group: 'quantity',
		weight: 0.1,
		provenance: {
			source: 'Modelled runoff climatology, v4 public dataset (REAL scores)',
			vintage: 2023,
			resolutionM: 9000,
			resolutionLabel: '5 arc-min (~9 km)',
			method: 'modelled',
			caveat: 'Understates variability in basins with short simulated records.'
		}
	},
	{
		code: 'sev',
		label: 'Seasonal variability',
		description: 'Within-year variability of available supply (monsoon amplitude).',
		group: 'quantity',
		weight: 0.1,
		provenance: {
			source: 'Modelled monthly runoff climatology, v4 public dataset (REAL scores)',
			vintage: 2023,
			resolutionM: 9000,
			resolutionLabel: '5 arc-min (~9 km)',
			method: 'modelled',
			caveat: 'Monthly averages hide sub-monthly dry spells relevant to intakes.'
		}
	},
	{
		code: 'rfr',
		label: 'Riverine flood risk',
		description: 'Expected population/asset exposure to river flooding.',
		group: 'quantity',
		weight: 0.05,
		provenance: {
			source: 'Modelled inundation fractions, v4 public dataset (REAL scores)',
			vintage: 2023,
			resolutionM: 1000,
			resolutionLabel: '~1 km',
			method: 'modelled',
			caveat: 'No levee or drainage-infrastructure data — protected areas can score high.'
		}
	},
	{
		code: 'cfr',
		label: 'Coastal flood risk',
		description: 'Expected exposure to coastal flooding including subsidence.',
		group: 'quantity',
		weight: 0.05,
		provenance: {
			source: 'Modelled coastal inundation, v4 public dataset (REAL scores)',
			vintage: 2023,
			resolutionM: 1000,
			resolutionLabel: '~1 km',
			method: 'modelled',
			caveat: 'Delta subsidence rates are extrapolated from few InSAR tracks.'
		}
	},
	{
		code: 'drr',
		label: 'Drought risk',
		description: 'Probability-weighted drought hazard, exposure, and vulnerability.',
		group: 'quantity',
		weight: 0.1,
		provenance: {
			source: 'Composite drought index, v4 public dataset (REAL scores)',
			vintage: 2023,
			resolutionM: 9000,
			resolutionLabel: '5 arc-min (~9 km)',
			method: 'modelled',
			caveat: 'Vulnerability layer is national-scale; sub-national variation is smoothed.'
		}
	},
	{
		code: 'ucw',
		label: 'Untreated connected wastewater',
		description: 'Share of collected wastewater discharged without treatment.',
		group: 'quality',
		weight: 0.6,
		provenance: {
			source: 'Wastewater treatment statistics, v4 public dataset (REAL scores)',
			vintage: 2023,
			resolutionM: 50000,
			resolutionLabel: 'admin-unit (~50 km)',
			method: 'proxy',
			caveat: 'Self-reported treatment levels; informal discharge is not captured.'
		}
	},
	{
		code: 'cep',
		label: 'Coastal eutrophication potential',
		description: 'Nutrient loading potential reaching coastal waters.',
		group: 'quality',
		weight: 0.4,
		provenance: {
			source: 'Nutrient export model, v4 public dataset (REAL scores)',
			vintage: 2023,
			resolutionM: 9000,
			resolutionLabel: '5 arc-min (~9 km)',
			method: 'modelled',
			caveat: 'Fertilizer application rates are provincial averages.'
		}
	},
	{
		code: 'udw',
		label: 'Unimproved drinking water',
		description: 'Share of population without access to improved drinking water.',
		group: 'rrr',
		weight: 0.35,
		provenance: {
			source: 'Household survey statistics, v4 public dataset (REAL scores)',
			vintage: 2023,
			resolutionM: 50000,
			resolutionLabel: 'admin-unit (~50 km)',
			method: 'observed',
			caveat: 'Survey waves are 3–5 years apart; fast-growing districts lag.'
		}
	},
	{
		code: 'usa',
		label: 'Unimproved sanitation',
		description: 'Share of population without access to improved sanitation.',
		group: 'rrr',
		weight: 0.25,
		provenance: {
			source: 'Household survey statistics, v4 public dataset (REAL scores)',
			vintage: 2023,
			resolutionM: 50000,
			resolutionLabel: 'admin-unit (~50 km)',
			method: 'observed',
			caveat: 'Same survey cadence limits as drinking-water access.'
		}
	},
	{
		code: 'rri',
		label: 'Regulatory & reputational risk',
		description: 'Governance capacity, water conflict, and media-signal composite.',
		group: 'rrr',
		weight: 0.4,
		provenance: {
			source: 'Governance & media-signal composite, v4 public dataset (REAL scores)',
			vintage: 2023,
			resolutionM: 50000,
			resolutionLabel: 'admin-unit (~50 km)',
			method: 'proxy',
			caveat: 'Media-derived; coverage bias toward larger basins and English/Vietnamese sources.'
		}
	}
];

export const INDICATOR_BY_CODE: Record<IndicatorCode, IndicatorDef> = Object.fromEntries(
	INDICATORS.map((d) => [d.code, d])
) as Record<IndicatorCode, IndicatorDef>;

export const INDICATOR_CODES = INDICATORS.map((d) => d.code);

// ---------- score arithmetic ----------

export type GroupWeights = Record<GroupId, number>;

export const DEFAULT_GROUP_WEIGHTS: GroupWeights = {
	quantity: GROUPS.quantity.weight,
	quality: GROUPS.quality.weight,
	rrr: GROUPS.rrr.weight
};

export interface Contribution {
	code: IndicatorCode;
	value: number;
	/** effective (renormalized) weight actually used in the sum */
	weight: number;
	weighted: number;
	noData: boolean;
}

export interface Decomposition {
	overall: number;
	overallClass: number;
	groups: { id: GroupId; label: string; score: number; weight: number }[];
	contributions: Contribution[];
}

/**
 * Weighted overall score with framework-style NO_DATA handling: missing
 * indicators are excluded and the remaining weights are renormalized so the
 * headline stays on the 0–5 scale. This renormalization is the single source
 * of truth — score-card tables must sum to the headline exactly.
 */
export function overallScore(
	values: Partial<Record<IndicatorCode, number>>,
	groupWeights: GroupWeights = DEFAULT_GROUP_WEIGHTS
): Decomposition {
	const raw = INDICATORS.map((d) => {
		const v = values[d.code];
		const noData = v === undefined || v === null || v === NO_DATA;
		return { def: d, value: noData ? NO_DATA : (v as number), noData };
	});
	const totalAvailable = raw
		.filter((r) => !r.noData)
		.reduce((s, r) => s + groupWeights[r.def.group] * r.def.weight, 0);

	const contributions: Contribution[] = raw.map((r) => {
		const w = r.noData ? 0 : (groupWeights[r.def.group] * r.def.weight) / (totalAvailable || 1);
		return {
			code: r.def.code,
			value: r.value,
			weight: w,
			weighted: r.noData ? 0 : r.value * w,
			noData: r.noData
		};
	});
	const overall = contributions.reduce((s, c) => s + c.weighted, 0);

	const groups = (Object.keys(GROUPS) as GroupId[]).map((g) => {
		const inGroup = raw.filter((r) => r.def.group === g && !r.noData);
		const wSum = inGroup.reduce((s, r) => s + r.def.weight, 0);
		const score = wSum ? inGroup.reduce((s, r) => s + r.value * r.def.weight, 0) / wSum : 0;
		return { id: g, label: GROUPS[g].label, score, weight: groupWeights[g] };
	});

	return { overall, overallClass: riskClassIndex(overall), groups, contributions };
}

/** top-n contributions by weighted share, excluding no-data */
export function dominantDrivers(decomp: Decomposition, n = 3): Contribution[] {
	return decomp.contributions
		.filter((c) => !c.noData)
		.toSorted((a, b) => b.weighted - a.weighted)
		.slice(0, n);
}

// ---------- risk classes ----------

export interface RiskClass {
	label: string;
	color: string;
	min: number;
	max: number;
}

/** water-risk 5-class ramp; breaks at 1/2/3/4 on the 0–5 scale */
export const RISK_CLASSES: RiskClass[] = [
	{ label: 'Low', color: '#fde68a', min: 0, max: 1 },
	{ label: 'Low–medium', color: '#fbbf24', min: 1, max: 2 },
	{ label: 'Medium–high', color: '#f97316', min: 2, max: 3 },
	{ label: 'High', color: '#dc2626', min: 3, max: 4 },
	{ label: 'Extremely high', color: '#7f1d1d', min: 4, max: 5 }
];

export const NO_DATA_COLOR = '#9a938c';

export function riskClassIndex(score: number): number {
	return Math.min(4, Math.max(0, Math.floor(score)));
}

export function riskClass(score: number): RiskClass {
	return RISK_CLASSES[riskClassIndex(score)];
}

export function classLabel(i: number): string {
	return RISK_CLASSES[Math.min(4, Math.max(0, i))].label;
}

export const fmtScore = (v: number) => (v === NO_DATA ? 'no data' : v.toFixed(2));

// ---------- ensemble ----------

export const ENSEMBLE_MODELS = ['h08', 'pcrglobwb', 'watergap2', 'cwatm', 'lpjml'] as const;
export type EnsembleModel = (typeof ENSEMBLE_MODELS)[number];

export const MODEL_LABELS: Record<EnsembleModel, string> = {
	h08: 'H08',
	pcrglobwb: 'PCR-GLOBWB',
	watergap2: 'WaterGAP2',
	cwatm: 'CWatM',
	lpjml: 'LPJmL'
};

/** categorical dot colors for the strip plot (distinct from the risk ramp) */
export const MODEL_COLORS: Record<EnsembleModel, string> = {
	h08: '#2563eb',
	pcrglobwb: '#0d9488',
	watergap2: '#7c3aed',
	cwatm: '#db2777',
	lpjml: '#65a30d'
};

export type ScenarioPrefix = 'bws' | 'fut';

export const SCENARIO_LABELS: Record<ScenarioPrefix, string> = {
	bws: 'Baseline',
	fut: '2050 projection'
};

export type Agreement = 'high' | 'medium' | 'low' | 'nodata';

export function ensembleValues(
	props: Record<string, unknown>,
	prefix: ScenarioPrefix
): Record<EnsembleModel, number> {
	return Object.fromEntries(
		ENSEMBLE_MODELS.map((m) => [m, Number(props[`${prefix}_${m}`])])
	) as Record<EnsembleModel, number>;
}

/** largest gap between adjacent sorted model values (bimodality detector) */
export function bimodalGap(values: Record<EnsembleModel, number>): {
	gap: number;
	gapLo: number;
	gapHi: number;
} {
	const sorted = Object.values(values).toSorted((a, b) => a - b);
	let gap = 0;
	let gapLo = sorted[0];
	let gapHi = sorted[0];
	for (let i = 1; i < sorted.length; i++) {
		const g = sorted[i] - sorted[i - 1];
		if (g > gap) {
			gap = g;
			gapLo = sorted[i - 1];
			gapHi = sorted[i];
		}
	}
	return { gap, gapLo, gapHi };
}

// ---------- VSUP (value-suppressing uncertainty palette) ----------
// Risk ramp at three agreement levels: hue collapses toward a shared neutral
// as model agreement drops, so uncertain basins render visually non-committal.
// Hexes precomputed (mix toward #9a938c at 0% / 45% / 75%).

export const VSUP: Record<Exclude<Agreement, 'nodata'>, string[]> = {
	high: ['#fde68a', '#fbbf24', '#f97316', '#dc2626', '#7f1d1d'],
	medium: ['#d0c18b', '#cfab53', '#ce814b', '#be5754', '#8b524f'],
	low: ['#b3a88c', '#b29e72', '#b28b6f', '#ab7873', '#937670']
};

/** purple ramp for the spread view — deliberately a different hue than risk */
export const SPREAD_RAMP = ['#efeae3', '#b8a6d9', '#7c5cbf', '#4c1d95'];

// ---------- map paint expressions ----------

function stepRamp(prop: string, colors: string[]): unknown {
	return ['step', ['get', prop], colors[0], 1, colors[1], 2, colors[2], 3, colors[3], 4, colors[4]];
}

/** wrap any basin paint expression with the no-data gray guard */
function noDataGuard(p: ScenarioPrefix, expr: unknown): unknown {
	return ['case', ['==', ['get', `${p}_mean`], NO_DATA], NO_DATA_COLOR, expr];
}

/** bivariate fill: risk class from P_mean, saturation from P_agreement */
export function meanVsupExpression(p: ScenarioPrefix): unknown {
	return noDataGuard(p, [
		'match',
		['get', `${p}_agreement`],
		'high',
		stepRamp(`${p}_mean`, VSUP.high),
		'medium',
		stepRamp(`${p}_mean`, VSUP.medium),
		stepRamp(`${p}_mean`, VSUP.low)
	]);
}

export function spreadExpression(p: ScenarioPrefix): unknown {
	return noDataGuard(p, [
		'interpolate',
		['linear'],
		['get', `${p}_range`],
		0,
		SPREAD_RAMP[0],
		1,
		SPREAD_RAMP[1],
		2.2,
		SPREAD_RAMP[2],
		3.6,
		SPREAD_RAMP[3]
	]);
}

export function modelExpression(p: ScenarioPrefix, model: EnsembleModel): unknown {
	return noDataGuard(p, stepRamp(`${p}_${model}`, VSUP.high));
}

/** single-indicator choropleth (why-this-score focus mode); no-data gray */
export function indicatorExpression(code: IndicatorCode): unknown {
	return [
		'case',
		['==', ['get', code], NO_DATA],
		NO_DATA_COLOR,
		stepRamp(
			code,
			RISK_CLASSES.map((c) => c.color)
		)
	];
}

/** bbox of a Polygon or MultiPolygon feature (outer rings only) */
export function polygonBounds(f: GeoJSON.Feature): [[number, number], [number, number]] {
	let minX = Infinity,
		minY = Infinity,
		maxX = -Infinity,
		maxY = -Infinity;
	const rings =
		f.geometry.type === 'MultiPolygon'
			? (f.geometry as GeoJSON.MultiPolygon).coordinates.map((poly) => poly[0])
			: [(f.geometry as GeoJSON.Polygon).coordinates[0]];
	for (const ring of rings) {
		for (const [x, y] of ring) {
			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x);
			maxY = Math.max(maxY, y);
		}
	}
	return [
		[minX, minY],
		[maxX, maxY]
	];
}

// ---------- hover ----------

export const WATER_RISK_HOVER_LAYERS: HoverLayerConfig[] = [
	{
		layerId: 'basins-fill',
		title: (p) => String(p.name ?? 'Sub-basin'),
		fields: [
			{
				prop: 'bws_mean',
				label: 'water stress',
				format: (v) =>
					Number(v) === NO_DATA ? 'no data' : `${Number(v).toFixed(1)} — ${riskClass(Number(v)).label}`
			},
			{ prop: 'bws_agreement', label: 'model agreement' },
			{
				prop: 'bws_range',
				label: 'ensemble range',
				format: (_, p) =>
					Number(p.bws_mean) === NO_DATA ? '—' : `${p.bws_min}–${p.bws_max}`
			},
			{ prop: 'note', label: 'source' }
		]
	}
];

// ---------- scale-of-use verdict (DL-107/108) ----------

export type ScaleLevel = 'screening' | 'caution' | 'not-decision-grade';

export interface ScaleVerdict {
	level: ScaleLevel;
	/** how many screen pixels one native data cell spans at the current zoom */
	cellSpanPx: number;
}

/**
 * Compare view scale against an indicator's native resolution. When one data
 * cell stretches across many screen pixels, the user is reading sub-cell
 * detail that does not exist in the data.
 */
export function scaleVerdict(metersPerPixel: number, resolutionM: number): ScaleVerdict {
	const cellSpanPx = resolutionM / metersPerPixel;
	const level: ScaleLevel =
		cellSpanPx < 8 ? 'screening' : cellSpanPx <= 40 ? 'caution' : 'not-decision-grade';
	return { level, cellSpanPx };
}
