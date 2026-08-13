import type { MockSpec } from '$lib/llm/types';
import type { ParsedQuery } from './schema';

// Mock parses use the REAL attribute vocabulary from the Overture extract
// (static/data/overture/inventory.json): land_use classes like farmland (373
// features in bbox), orchard (128), aquaculture (29), industrial (54); place
// categories like restaurant, hotel. flood_risk is the modelled overlay.

const farmlandFloodProne: ParsedQuery = {
	place: 'Can Tho',
	filters: [
		{ attribute: 'landuse_class', op: '==', value: 'farmland' },
		{ attribute: 'flood_risk', op: 'in', value: ['high', 'very_high'] }
	],
	highlightColor: '#dc2626',
	legend: {
		title: 'Farmland in high flood-risk bands',
		note: 'real Overture land use × modelled flood bands (high + very high)'
	}
};

const aquacultureOrchards: ParsedQuery = {
	place: 'Can Tho',
	filters: [{ attribute: 'landuse_class', op: 'in', value: ['aquaculture', 'orchard'] }],
	legend: {
		title: 'Aquaculture & orchards',
		note: 'Overture land_use classes: aquaculture, orchard'
	}
};

const confidentHospitality: ParsedQuery = {
	place: 'Can Tho',
	filters: [
		{ attribute: 'place_category', op: 'in', value: ['hotel', 'restaurant'] },
		{ attribute: 'place_confidence', op: '>=', value: 0.85 }
	],
	highlightColor: '#7c3aed',
	legend: {
		title: 'High-confidence hotels & restaurants',
		note: 'Overture places, confidence ≥ 0.85'
	}
};

const industrial: ParsedQuery = {
	camera: { center: [105.746, 10.045], zoom: 12.5 },
	filters: [{ attribute: 'landuse_class', op: '==', value: 'industrial' }],
	highlightColor: '#0284c7',
	legend: {
		title: 'Industrial land use',
		note: 'Overture land_use class = industrial'
	}
};

export const SUGGESTIONS: string[] = [
	'Show farmland in the high flood-risk bands in Can Tho',
	'Aquaculture and orchards',
	'High-confidence hotels and restaurants',
	'Industrial land use areas'
];

export function queryMock(): MockSpec {
	return {
		kind: 'fn',
		run: (req) => {
			const raw = req.messages
				.map((m) => (typeof m.content === 'string' ? m.content : ''))
				.join(' ');
			const text = raw.toLowerCase();

			// Refinement turn: mutate the ACTUAL current parse carried in the
			// prompt — the mock exercises the same edit-not-restart contract.
			const stateMatch = raw.match(/Current parsed state:\s*(\{[\s\S]*\})\s*Refinement:/);
			if (stateMatch) {
				const current = JSON.parse(stateMatch[1]) as ParsedQuery;
				return JSON.stringify(refine(current, text), null, 2);
			}

			const pick =
				text.includes('aquaculture') || text.includes('orchard')
					? aquacultureOrchards
					: text.includes('hotel') || text.includes('restaurant')
						? confidentHospitality
						: text.includes('industrial')
							? industrial
							: farmlandFloodProne;
			return JSON.stringify(pick, null, 2);
		}
	};
}

/** Canned refinement edits, applied to the real current parse. */
function refine(current: ParsedQuery, text: string): ParsedQuery {
	const next: ParsedQuery = JSON.parse(JSON.stringify(current));
	// refinements never re-fly the camera unless they name a place
	delete next.camera;
	delete next.place;

	if (/purple|violet/.test(text)) {
		next.highlightColor = '#7c3aed';
		next.legend.note = 'highlight color set by refinement';
	} else if (/red/.test(text)) {
		next.highlightColor = '#dc2626';
		next.legend.note = 'highlight color set by refinement';
	} else if (/no (color|highlight)|remove (the )?(color|highlight)/.test(text)) {
		delete next.highlightColor;
	} else if (/confiden/.test(text)) {
		next.filters = next.filters.filter((f) => f.attribute !== 'place_confidence');
		next.filters.push({ attribute: 'place_confidence', op: '>=', value: 0.85 });
		next.legend.note = 'restricted to confidence ≥ 0.85';
	} else if (/orchard/.test(text)) {
		const lu = next.filters.find((f) => f.attribute === 'landuse_class');
		if (lu) {
			const values = Array.isArray(lu.value) ? lu.value : [lu.value];
			lu.op = 'in';
			lu.value = [...new Set([...values, 'orchard'])];
		} else {
			next.filters.push({ attribute: 'landuse_class', op: '==', value: 'orchard' });
		}
		next.legend.title = `${next.legend.title} + orchards`;
	} else if (/(drop|remove|without|forget).*(flood|risk)/.test(text)) {
		next.filters = next.filters.filter((f) => f.attribute !== 'flood_risk');
		next.legend.note = 'flood-risk condition removed';
	} else if (/very.?high|worst|only the highest/.test(text)) {
		next.filters = next.filters.filter((f) => f.attribute !== 'flood_risk');
		next.filters.push({ attribute: 'flood_risk', op: '==', value: 'very_high' });
		next.legend.title = next.legend.title.replace(/high .*/i, 'very-high band only');
		next.legend.note = 'narrowed to the very-high modelled band';
	} else {
		// default refinement: tighten to the high+very-high bands
		next.filters = next.filters.filter((f) => f.attribute !== 'flood_risk');
		next.filters.push({ attribute: 'flood_risk', op: 'in', value: ['high', 'very_high'] });
		next.legend.note = 'tightened to high + very-high modelled bands';
	}
	return next;
}

/** Chained follow-ups surfaced after a query resolves. */
export const REFINEMENTS: string[] = [
	'now only the very-high band',
	'make them purple',
	'add orchards too',
	'drop the flood condition'
];
