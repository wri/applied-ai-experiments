import type { Schema } from '$lib/llm/types';
import type { MockSpec } from '$lib/llm/types';
import { LANDUSE_COLORS } from '../shared/canTho';

/** The fixed legend class list: real Overture land_use classes in the Can Tho bbox. */
export const LEGEND_CLASSES = Object.keys(LANDUSE_COLORS);

export interface LegendSpec {
	classes: { value: string; color: string; label?: string }[];
	rationale: string;
}

export const LEGEND_SPEC_SCHEMA: Schema = {
	type: 'object',
	required: ['classes', 'rationale'],
	additionalProperties: false,
	properties: {
		rationale: { type: 'string', maxLength: 300 },
		classes: {
			type: 'array',
			minItems: 1,
			maxItems: 9,
			items: {
				type: 'object',
				required: ['value', 'color'],
				additionalProperties: false,
				properties: {
					value: { enum: LEGEND_CLASSES },
					color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
					label: { type: 'string', maxLength: 30 }
				}
			}
		}
	}
};

// Okabe-Ito palette — the canonical colorblind-safe categorical set.
const colorblindSafe: LegendSpec = {
	rationale:
		'Okabe-Ito categorical palette: eight hues chosen to remain distinct under all common color-vision deficiencies; assignments keep vegetation-ish classes on the green/yellow side.',
	classes: [
		{ value: 'farmland', color: '#009e73', label: 'Farmland' },
		{ value: 'orchard', color: '#f0e442', label: 'Orchard' },
		{ value: 'aquaculture', color: '#56b4e9', label: 'Aquaculture' },
		{ value: 'grass', color: '#999999', label: 'Managed grass' },
		{ value: 'park', color: '#0072b2', label: 'Park' },
		{ value: 'residential', color: '#e69f00', label: 'Residential' },
		{ value: 'industrial', color: '#cc79a7', label: 'Industrial' },
		{ value: 'commercial', color: '#d55e00', label: 'Commercial' },
		{ value: 'school', color: '#000000', label: 'School' }
	]
};

const agricultureFocus: LegendSpec = {
	rationale:
		'Everything non-agricultural drops to warm grays; farmland, orchard and aquaculture keep saturated, distinct hues so the agricultural mosaic is the only story on the map.',
	classes: [
		{ value: 'farmland', color: '#2e7d32', label: 'Farmland' },
		{ value: 'orchard', color: '#9e9d24', label: 'Orchard' },
		{ value: 'aquaculture', color: '#00838f', label: 'Aquaculture' },
		{ value: 'grass', color: '#d7d3cd', label: 'Grass' },
		{ value: 'park', color: '#c9c5bf', label: 'Park' },
		{ value: 'residential', color: '#d7d3cd', label: 'Residential' },
		{ value: 'industrial', color: '#bbb7b1', label: 'Industrial' },
		{ value: 'commercial', color: '#c9c5bf', label: 'Commercial' },
		{ value: 'school', color: '#d7d3cd', label: 'School' }
	]
};

const projection: LegendSpec = {
	rationale:
		'High-contrast saturated darks for projection in a bright room: every class pushed toward its hue extreme, labels shortened to read from the back row.',
	classes: [
		{ value: 'farmland', color: '#1b5e20', label: 'Farm' },
		{ value: 'orchard', color: '#827717', label: 'Orchard' },
		{ value: 'aquaculture', color: '#006064', label: 'Aqua' },
		{ value: 'grass', color: '#33691e', label: 'Grass' },
		{ value: 'park', color: '#2e7d32', label: 'Park' },
		{ value: 'residential', color: '#b71c1c', label: 'Homes' },
		{ value: 'industrial', color: '#4a148c', label: 'Industry' },
		{ value: 'commercial', color: '#880e4f', label: 'Shops' },
		{ value: 'school', color: '#0d47a1', label: 'Schools' }
	]
};

export function restyleMock(): MockSpec {
	return {
		kind: 'fn',
		run: (req) => {
			const text = req.messages
				.map((m) => (typeof m.content === 'string' ? m.content : ''))
				.join(' ')
				.toLowerCase();
			const pick =
				text.includes('agri') || text.includes('farm') || text.includes('mute')
					? agricultureFocus
					: text.includes('contrast') || text.includes('project')
						? projection
						: colorblindSafe;
			return JSON.stringify(pick, null, 2);
		}
	};
}

/** Per-class ask answers — composed against the real Overture provenance. */
export const ASK_MOCKS: Record<string, string> = {
	farmland:
		'Farmland is the largest land-use class in this view — real Overture polygons, mostly OSM-mapped paddy and field parcels of the Mekong Delta. Coverage is good along roads and canals but thins in the interior, so treat absence of farmland as "unmapped", not "not farmland". (mock response)',
	orchard:
		'Orchard polygons here are real OSM-sourced Overture features — the fruit-growing belts typical of Mekong levee soils. Orchard vs farmland boundaries are drawn by volunteer mappers and can lag conversion by years. (mock response)',
	aquaculture:
		'Aquaculture ponds are real Overture land use, but only 29 polygons are mapped in this bbox — almost certainly an undercount for the delta. Cross-check against imagery before quoting areas; unmapped ponds are the norm, not the exception. (mock response)',
	grass: 'Managed grass covers verges, lawns and kept open space — real Overture data, but a catch-all class. It rarely matters analytically; consider merging it visually with park. (mock response)',
	park: 'Parks are real Overture features with good coverage in the urban core. Smaller neighborhood greens may be tagged as grass instead — the class boundary is a mapping convention, not a physical one. (mock response)',
	residential:
		'Residential land use is real Overture data; in Vietnamese cities the mapped polygons often trace administrative blocks rather than actual built extent, so density within a polygon varies a lot. (mock response)',
	industrial:
		'Industrial zones are real Overture polygons — the riverside processing and port strip is the visible cluster. Smaller workshops embedded in residential blocks are typically not mapped separately. (mock response)',
	commercial:
		'Commercial land use is sparse in the data (16 polygons in this bbox) because most retail here is shophouse-based and mapped as places, not land use. Use the places layer for commercial questions. (mock response)',
	school:
		'School grounds are real Overture features and usefully complete — education land use is a common OSM mapping priority. The polygon is the campus, not the building. (mock response)'
};
