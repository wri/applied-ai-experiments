/**
 * Shared constants for the Can Tho scene: real Overture layers (land use,
 * buildings, water, places) plus the modelled flood-risk overlay. The land-use
 * class vocabulary comes from static/data/overture/inventory.json — extracted
 * from the live GeoParquet, never guessed (rerun pnpm extract-overture to refresh).
 */

import { fmtPct, humanize, type HoverLayerConfig } from '$lib/map/hover';

export const FLOOD_RISK_CLASSES = ['low', 'medium', 'high', 'very_high'] as const;
export type FloodRisk = (typeof FLOOD_RISK_CLASSES)[number];

/** Monorepo choropleth ramp (amber family) — reserved for the modelled flood overlay */
export const FLOOD_COLORS: Record<FloodRisk, string> = {
	low: '#fef3c7',
	medium: '#fcd34d',
	high: '#f59e0b',
	very_high: '#b45309'
};

export const FLOOD_LABELS: Record<FloodRisk, string> = {
	low: 'Low',
	medium: 'Medium',
	high: 'High',
	very_high: 'Very high'
};

export const WATER_COLOR = '#38bdf8';
export const PLACE_COLOR = '#60a5fa';

/** Interactive (scene-added) layers over the Overture sources + modelled overlays. */
export const INTERACTIVE_LAYERS = [
	'landuse-fill',
	'landuse-outline',
	'buildings-fill',
	'water-fill',
	'water-line',
	'flood-zones',
	'flood-zones-outline',
	'places-dots'
] as const;
export type InteractiveLayerId = (typeof INTERACTIVE_LAYERS)[number];

/**
 * Categorical colors for the real Overture land_use classes present in the
 * Can Tho bbox (top classes by count in inventory.json). Amber is reserved
 * for the flood ramp; greens/teals/violets carry land use.
 */
export const LANDUSE_COLORS: Record<string, string> = {
	farmland: '#6da34d',
	orchard: '#9bc26b',
	aquaculture: '#3fb8af',
	grass: '#4f7f5a',
	park: '#54b06e',
	residential: '#c07f7f',
	industrial: '#8f7fc0',
	commercial: '#d97fb0',
	school: '#7fa6c0'
};
export const LANDUSE_FALLBACK_COLOR = '#9a938c';

export const LANDUSE_LABELS: Record<string, string> = {
	farmland: 'Farmland',
	orchard: 'Orchard',
	aquaculture: 'Aquaculture',
	grass: 'Managed grass',
	park: 'Park',
	residential: 'Residential',
	industrial: 'Industrial',
	commercial: 'Commercial',
	school: 'School'
};

export function landuseColorExpression(): unknown {
	const pairs = Object.entries(LANDUSE_COLORS).flat();
	return ['match', ['get', 'class'], ...pairs, LANDUSE_FALLBACK_COLOR];
}

export function floodColorExpression(): unknown {
	return [
		'match',
		['get', 'flood_risk'],
		'low',
		FLOOD_COLORS.low,
		'medium',
		FLOOD_COLORS.medium,
		'high',
		FLOOD_COLORS.high,
		'very_high',
		FLOOD_COLORS.very_high,
		'#888888'
	];
}

/**
 * The queryable attribute vocabulary: which layer carries each attribute and
 * which feature property it maps to. Filters route per layer through this
 * table (real attributes live on different layers). Building height is absent
 * on purpose: only 9 of ~395k Can Tho buildings carry a height value.
 */
export const ATTRIBUTE_TARGETS = {
	/** Real Overture land_use class, e.g. farmland | orchard | aquaculture | residential | industrial */
	landuse_class: { layer: 'landuse-fill', property: 'class' },
	/** Real Overture land_use subtype, e.g. agriculture | developed | recreation | education */
	landuse_subtype: { layer: 'landuse-fill', property: 'subtype' },
	/** MODELLED flood-risk band: low | medium | high | very_high */
	flood_risk: { layer: 'flood-zones', property: 'flood_risk' },
	/** Real Overture place category, e.g. restaurant | coffee_shop | hotel | school */
	place_category: { layer: 'places-dots', property: 'basic_category' },
	/** Real Overture place confidence, 0.5–1.0 in this extract */
	place_confidence: { layer: 'places-dots', property: 'confidence' }
} as const satisfies Record<string, { layer: InteractiveLayerId; property: string }>;

export type QueryAttribute = keyof typeof ATTRIBUTE_TARGETS;
export const QUERY_ATTRIBUTES = Object.keys(ATTRIBUTE_TARGETS) as QueryAttribute[];

/**
 * Hover-attributes config for the shared scene. Order = hit priority:
 * dots over flood bands over land use.
 */
export const CAN_THO_HOVER_LAYERS: HoverLayerConfig[] = [
	{
		layerId: 'places-dots',
		title: (p) => String(p.name ?? 'Place'),
		hitPad: 5,
		fields: [
			{ prop: 'basic_category', label: 'category', format: humanize },
			{ prop: 'confidence', label: 'confidence', format: fmtPct }
		]
	},
	{
		layerId: 'flood-zones',
		title: 'Modelled flood risk',
		fields: [
			{
				prop: 'flood_risk',
				label: 'band',
				format: (v) => FLOOD_LABELS[v as FloodRisk] ?? humanize(v)
			},
			{
				prop: 'dist_min_m',
				label: 'distance',
				format: (_, p) => `${p.dist_min_m}–${p.dist_max_m} m from channel`
			},
			{ prop: 'note', label: 'source' }
		]
	},
	{
		layerId: 'landuse-fill',
		title: (p) => LANDUSE_LABELS[String(p.class)] ?? humanize(p.class),
		fields: [
			{ prop: 'class', label: 'class', format: humanize },
			{ prop: 'subtype', label: 'subtype', format: humanize }
		]
	}
];
