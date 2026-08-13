/**
 * StylePatch — the containment layer for LLM-driven style changes. The model
 * never emits raw MapLibre style JSON; it emits a constrained op list against
 * whitelisted layers and properties, schema-validated and semantically checked
 * before anything touches the map.
 */

import type { Schema } from '$lib/llm/types';

export const PATCHABLE_LAYERS = [
	'landuse-fill',
	'landuse-outline',
	'buildings-fill',
	'water-fill',
	'water-line',
	'flood-zones',
	'flood-zones-outline',
	'places-dots'
] as const;

export const PAINT_PROPERTIES = [
	'fill-color',
	'fill-opacity',
	'fill-outline-color',
	'line-color',
	'line-width',
	'line-opacity',
	'circle-color',
	'circle-radius',
	'circle-opacity',
	'circle-stroke-color',
	'circle-stroke-width'
] as const;

export const LAYOUT_PROPERTIES = ['visibility'] as const;

export const FILTERABLE_ATTRIBUTES = [
	'class',
	'subtype',
	'flood_risk',
	'basic_category',
	'confidence',
	'name'
] as const;

export interface StyleOp {
	op: 'setPaint' | 'setLayout' | 'setFilter';
	layer: (typeof PATCHABLE_LAYERS)[number];
	/** paint/layout property; ignored for setFilter */
	property?: string;
	/** paint/layout value or a MapLibre filter expression (setFilter); null clears a filter */
	value: unknown;
}

export interface StylePatch {
	ops: StyleOp[];
	rationale: string;
}

export const STYLE_PATCH_SCHEMA: Schema = {
	type: 'object',
	required: ['ops', 'rationale'],
	additionalProperties: false,
	properties: {
		rationale: { type: 'string', maxLength: 400 },
		ops: {
			type: 'array',
			minItems: 1,
			maxItems: 12,
			items: {
				type: 'object',
				required: ['op', 'layer', 'value'],
				additionalProperties: false,
				properties: {
					op: { enum: ['setPaint', 'setLayout', 'setFilter'] },
					layer: { enum: [...PATCHABLE_LAYERS] },
					property: { enum: [...PAINT_PROPERTIES, ...LAYOUT_PROPERTIES] },
					value: {}
				}
			}
		}
	}
};

/** Per-layer attribute catalog for prompts — real Overture vocab from inventory.json */
export const ATTRIBUTES_PROMPT = `Patchable layers and their feature attributes:
- "landuse-fill" / "landuse-outline" (fill/line; REAL Overture land use):
  - subtype: "agriculture" | "horticulture" | "developed" | "recreation" | "education" | "managed" | "residential" | "park" | "medical" | "aquaculture"
  - class: "farmland" | "orchard" | "aquaculture" | "grass" | "pitch" | "school" | "park" | "industrial" | "garden" | "residential" | "commercial" | "hospital"
- "buildings-fill" (fill; REAL Overture buildings; most features carry no height here)
- "water-fill" / "water-line" (fill/line; REAL Overture water — polygons and channel lines)
- "flood-zones" / "flood-zones-outline" (fill/line; MODELLED flood-risk bands, not real data):
  - flood_risk: "low" | "medium" | "high" | "very_high"
- "places-dots" (circle; REAL Overture places):
  - basic_category: e.g. "restaurant", "coffee_shop", "cafe", "hotel", "casual_eatery", "fashion_and_apparel_store", "electronics_store", "school"
  - confidence: number 0.5-1.0
  - name: string
Filters use MapLibre expression syntax, e.g. ["==", ["get", "class"], "farmland"] or ["all", cond1, cond2].
Colors are CSS hex strings. fill-color/circle-color may also be a ["match", ["get", "attr"], v1, color1, ..., fallback] expression.`;
