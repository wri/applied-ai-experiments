import type { MockSpec } from '$lib/llm/types';
import type { WatchRule } from './rules';

export const SUGGESTED_WATCHES: string[] = [
	'Alert me if the flood touches more than 100 farm sites',
	'Warn me when over 40 high-exposure sites are inside the extent',
	'Tell me if the modelled extent grows past 8,000 km²'
];

const CANNED: { pattern: RegExp; rule: WatchRule }[] = [
	{
		pattern: /100|farm sites|touches more/,
		rule: {
			metric: 'farms_touched',
			op: '>',
			threshold: 100,
			label: 'flood touches >100 farm sites'
		}
	},
	{
		pattern: /high.?exposure|40/,
		rule: {
			metric: 'sites_high_exposure',
			op: '>',
			threshold: 40,
			label: '>40 high-exposure sites in extent'
		}
	},
	{
		pattern: /km|area|8.?000|extent grows/,
		rule: {
			metric: 'extent_area_km2',
			op: '>',
			threshold: 8000,
			label: 'modelled extent >8,000 km²'
		}
	}
];

export function watchMock(): MockSpec {
	return {
		kind: 'match',
		cases: CANNED.map((c) => ({
			pattern: c.pattern,
			text: JSON.stringify(c.rule, null, 2)
		})),
		fallback: JSON.stringify(CANNED[0].rule, null, 2)
	};
}
