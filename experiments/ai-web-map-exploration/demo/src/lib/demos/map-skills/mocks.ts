import type { MockSpec } from '$lib/llm/types';
import type { Plan } from './runner.svelte';

export const SUGGESTED_TASKS = [
	'Which farmland is exposed to flooding?',
	'Walk me through what changed this week',
	'Give me a tour of this dataset'
];

const floodPlan: Plan = {
	steps: [
		{
			tool: 'flyTo',
			args: { center: [105.746, 10.03], zoom: 11.6 },
			narration: 'Frame the full study area so no exposed farmland sits outside the assessment.'
		},
		{
			tool: 'setFilter',
			args: {
				layer: 'landuse-fill',
				filter: ['==', ['get', 'class'], 'farmland']
			},
			narration: 'Isolate the asset layer: real Overture land use filtered to class "farmland".'
		},
		{
			tool: 'setFilter',
			args: {
				layer: 'flood-zones',
				filter: ['in', ['get', 'flood_risk'], ['literal', ['high', 'very_high']]]
			},
			narration: 'Isolate the high and very-high modelled bands — the skill forbids counting anything else.'
		},
		{
			tool: 'flyTo',
			args: { center: [105.72, 10.005], zoom: 13.1 },
			narration: 'Move to the densest exposed farmland, on the low southwest bank.'
		},
		{
			tool: 'highlight',
			args: { center: [105.718, 10.002] },
			narration: 'Highlight the worst cluster so the user can verify polygon by polygon.'
		},
		{
			tool: 'report',
			args: {
				text: 'Exposure: of 373 mapped farmland polygons (real Overture land use), roughly a third intersect the high or very-high modelled bands, concentrated on the southwest bank. Filter used: class = farmland × flood_risk in [high, very_high]. Caveat: the bands are distance-to-channel only — a modelled overlay, not observed inundation — and OSM farmland mapping thins away from roads, so treat both count and extent as lower bounds. Most exposed location: the highlighted cluster at 10.002, 105.718.'
			},
			narration: 'Report the exposed share, the exact filter, one uncertainty caveat, and the single most exposed location — the skill contract.'
		}
	]
};

const triagePlan: Plan = {
	steps: [
		{
			tool: 'flyTo',
			args: { center: [105.746, 10.045], zoom: 11.8 },
			narration: 'Collect: 4 change events intersect this region in the last 7 days. Window stated; below 0.25 severity, 1 event is noise and will not be walked.'
		},
		{
			tool: 'flyTo',
			args: { center: [105.762, 10.03], zoom: 13.4 },
			narration: 'Rank 1 — flood advisory upgrade (sev 0.82): gauge index crossed the 90th percentile here.'
		},
		{
			tool: 'highlight',
			args: { center: [105.762, 10.03] },
			narration: 'Highlight the advisory zone. Confidence: medium — single-source gauge composite.'
		},
		{
			tool: 'flyTo',
			args: { center: [105.73, 10.0], zoom: 12.8 },
			narration: 'Rank 2 — the quarterly model run shifted the flood bands along the southern bank, moving 96 farmland polygons between classes. These two events are within 5 km and are possibly related.'
		},
		{
			tool: 'report',
			args: {
				text: 'Triage: 4 events, 3 above noise. Act on the flood advisory (rank 1): task a verification pass against the new post-advisory imagery. The band reclassification (rank 2) likely reflects the same water signal — hold until the advisory resolves. 1 routine imagery event needs no action.'
			},
			narration: 'End with one recommended action for the top event.'
		}
	]
};

const tourPlan: Plan = {
	steps: [
		{
			tool: 'flyTo',
			args: { center: [105.746, 10.035], zoom: 11.3 },
			narration: 'Establish: real Overture land use for Cần Thơ — 373 farmland, 128 orchard, 29 aquaculture polygons — under a modelled flood-band overlay along the Hậu River.'
		},
		{
			tool: 'flyTo',
			args: { center: [105.76, 10.04], zoom: 13.6 },
			narration: 'Contrast, close #1: the riverside very-high band — the urban core and its land-use mosaic pressed against the channel.'
		},
		{
			tool: 'flyTo',
			args: { center: [105.62, 10.1], zoom: 13.2 },
			narration: 'Contrast, close #2: the far northwest — farmland on the delta interior, outside every modelled band.'
		},
		{
			tool: 'highlight',
			args: { center: [105.71, 10.08] },
			narration: 'Anomaly: mapped land use thins inland even though farming plainly continues — an OSM coverage gap, not a land-cover change. Real data carries real absences.'
		},
		{
			tool: 'flyTo',
			args: { center: [105.746, 10.035], zoom: 11.3 },
			narration: 'Return wide. Takeaway: the flood bands are a distance model, the land use is real but incomplete — reading this map means holding both provenances in mind at once.'
		}
	]
};

export function routerMock(): MockSpec {
	return {
		kind: 'fn',
		run: (req) => {
			const text = req.messages
				.map((m) => (typeof m.content === 'string' ? m.content : ''))
				.join(' ')
				.toLowerCase();
			const skill = text.includes('flood') || text.includes('exposed')
				? 'flood-exposure-assessment'
				: text.includes('changed') || text.includes('week') || text.includes('new')
					? 'change-detection-triage'
					: 'viewport-storytelling';
			return JSON.stringify({
				skill,
				reason: `Trigger words in the task matched this skill's frontmatter. (mock router)`
			});
		}
	};
}

export function planMock(): MockSpec {
	return {
		kind: 'fn',
		run: (req) => {
			const text = req.messages
				.map((m) => (typeof m.content === 'string' ? m.content : ''))
				.concat(req.system ?? '')
				.join(' ')
				.toLowerCase();
			const plan = text.includes('flood-exposure')
				? floodPlan
				: text.includes('change-detection')
					? triagePlan
					: tourPlan;
			return JSON.stringify(plan, null, 2);
		}
	};
}
