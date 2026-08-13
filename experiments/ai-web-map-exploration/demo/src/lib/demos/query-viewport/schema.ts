import type { Schema } from '$lib/llm/types';
import type { FilterSpecification } from 'maplibre-gl';
import {
	ATTRIBUTE_TARGETS,
	QUERY_ATTRIBUTES,
	type InteractiveLayerId,
	type QueryAttribute
} from '../shared/canTho';

export interface QueryFilter {
	attribute: QueryAttribute;
	op: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in';
	value: string | number | (string | number)[];
}

export interface ParsedQuery {
	/** place name to geocode when no explicit camera */
	place?: string;
	camera?: { center: [number, number]; zoom: number };
	filters: QueryFilter[];
	/** optional emphasis: features matching filters get this color */
	highlightColor?: string;
	legend: { title: string; note?: string };
}

export const QUERY_SCHEMA: Schema = {
	type: 'object',
	required: ['filters', 'legend'],
	additionalProperties: false,
	properties: {
		place: { type: 'string' },
		camera: {
			type: 'object',
			required: ['center', 'zoom'],
			additionalProperties: false,
			properties: {
				center: {
					type: 'array',
					minItems: 2,
					maxItems: 2,
					items: { type: 'number' }
				},
				zoom: { type: 'number', minimum: 1, maximum: 20 }
			}
		},
		filters: {
			type: 'array',
			maxItems: 6,
			items: {
				type: 'object',
				required: ['attribute', 'op', 'value'],
				additionalProperties: false,
				properties: {
					attribute: { enum: QUERY_ATTRIBUTES },
					op: { enum: ['==', '!=', '<', '<=', '>', '>=', 'in'] },
					value: {}
				}
			}
		},
		highlightColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
		legend: {
			type: 'object',
			required: ['title'],
			additionalProperties: false,
			properties: {
				title: { type: 'string', maxLength: 60 },
				note: { type: 'string', maxLength: 200 }
			}
		}
	}
};

function toExpression(f: QueryFilter): unknown {
	const property = ATTRIBUTE_TARGETS[f.attribute].property;
	if (f.op === 'in') {
		const values = Array.isArray(f.value) ? f.value : [f.value];
		return ['in', ['get', property], ['literal', values]];
	}
	return [f.op, ['get', property], f.value];
}

/**
 * Group filters by the layer their attribute lives on (real attributes are
 * spread across land use / places / the modelled flood overlay) and combine
 * each layer's conditions with ["all", ...].
 */
export function filtersToLayerExpressions(
	filters: QueryFilter[]
): Map<InteractiveLayerId, FilterSpecification> {
	const byLayer = new Map<InteractiveLayerId, unknown[]>();
	for (const f of filters) {
		const layer = ATTRIBUTE_TARGETS[f.attribute].layer;
		const list = byLayer.get(layer) ?? [];
		list.push(toExpression(f));
		byLayer.set(layer, list);
	}
	const out = new Map<InteractiveLayerId, FilterSpecification>();
	for (const [layer, parts] of byLayer) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		out.set(layer, (parts.length === 1 ? parts[0] : ['all', ...parts]) as any);
	}
	return out;
}

/** Layers a filter set targets (for dim/emphasis of the others). */
export function targetedLayers(filters: QueryFilter[]): Set<InteractiveLayerId> {
	return new Set(filters.map((f) => ATTRIBUTE_TARGETS[f.attribute].layer));
}

export function describeFilter(f: QueryFilter): string {
	const v = Array.isArray(f.value) ? f.value.join(', ') : f.value;
	return `${f.attribute} ${f.op} ${v}`;
}
