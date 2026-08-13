import type { MockSpec } from '$lib/llm/types';
import { FLOOD_COLORS } from '../shared/canTho';

const highlightVeryHigh = {
	rationale:
		'Isolate attention on the very-high modelled flood band: saturate it, drop the other bands to a faint wash, and thicken the water edge for hydrological context.',
	ops: [
		{
			op: 'setPaint',
			layer: 'flood-zones',
			property: 'fill-color',
			value: [
				'match',
				['get', 'flood_risk'],
				'very_high',
				'#dc2626',
				'high',
				FLOOD_COLORS.high,
				'#d6d3d1'
			]
		},
		{
			op: 'setPaint',
			layer: 'flood-zones',
			property: 'fill-opacity',
			value: ['match', ['get', 'flood_risk'], 'very_high', 0.7, 'high', 0.3, 0.08]
		},
		{ op: 'setPaint', layer: 'water-line', property: 'line-width', value: 3.5 }
	]
};

const waterProminent = {
	rationale:
		'Shift visual hierarchy to hydrology: deepen and widen the real water network, fade land use and the flood bands to context.',
	ops: [
		{ op: 'setPaint', layer: 'water-fill', property: 'fill-opacity', value: 0.55 },
		{ op: 'setPaint', layer: 'water-line', property: 'line-width', value: 4 },
		{ op: 'setPaint', layer: 'water-line', property: 'line-opacity', value: 1 },
		{ op: 'setPaint', layer: 'landuse-fill', property: 'fill-opacity', value: 0.12 },
		{ op: 'setPaint', layer: 'flood-zones', property: 'fill-opacity', value: 0.08 }
	]
};

const farmlandOnly = {
	rationale:
		'Filter both land-use layers to Overture class "farmland" and raise its opacity so agricultural land reads clearly against the basemap.',
	ops: [
		{
			op: 'setFilter',
			layer: 'landuse-fill',
			value: ['==', ['get', 'class'], 'farmland']
		},
		{
			op: 'setFilter',
			layer: 'landuse-outline',
			value: ['==', ['get', 'class'], 'farmland']
		},
		{ op: 'setPaint', layer: 'landuse-fill', property: 'fill-opacity', value: 0.7 }
	]
};

// Deliberately-broken first answer to exercise the repair loop keylessly:
// 'fill-glow' is not a whitelisted property.
const brokenAquaculture = {
	rationale: 'Emphasize aquaculture land use with a glow and stronger fill.',
	ops: [
		{ op: 'setPaint', layer: 'landuse-fill', property: 'fill-glow', value: '#22d3ee' },
		{
			op: 'setFilter',
			layer: 'landuse-fill',
			value: ['==', ['get', 'class'], 'aquaculture']
		}
	]
};

const fixedAquaculture = {
	rationale:
		'Emphasize aquaculture land use: filter both land-use layers to class "aquaculture" and give it a saturated cyan fill. (repaired: replaced non-existent fill-glow with fill-color)',
	ops: [
		{ op: 'setFilter', layer: 'landuse-fill', value: ['==', ['get', 'class'], 'aquaculture'] },
		{
			op: 'setFilter',
			layer: 'landuse-outline',
			value: ['==', ['get', 'class'], 'aquaculture']
		},
		{ op: 'setPaint', layer: 'landuse-fill', property: 'fill-color', value: '#0891b2' },
		{ op: 'setPaint', layer: 'landuse-fill', property: 'fill-opacity', value: 0.8 }
	]
};

export const SUGGESTIONS = [
	'Highlight the very-high flood-risk band, mute everything else',
	'Make the water more prominent and fade the land use',
	'Show only farmland',
	'Emphasize aquaculture zones (triggers a repair loop in mock mode)'
];

export function styleMock(): MockSpec {
	return {
		kind: 'fn',
		run: (req) => {
			const all = req.messages
				.map((m) => (typeof m.content === 'string' ? m.content : ''))
				.join('\n')
				.toLowerCase();
			const isRepairTurn = all.includes('failed schema validation') || all.includes('corrected json');
			if (all.includes('aquaculture')) {
				return JSON.stringify(isRepairTurn ? fixedAquaculture : brokenAquaculture, null, 2);
			}
			if (all.includes('water') && all.includes('prominent')) {
				return JSON.stringify(waterProminent, null, 2);
			}
			if (all.includes('farmland') || all.includes('rice')) {
				return JSON.stringify(farmlandOnly, null, 2);
			}
			return JSON.stringify(highlightVeryHigh, null, 2);
		}
	};
}
