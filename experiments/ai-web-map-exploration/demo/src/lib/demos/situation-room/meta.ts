import type { DemoDefinition } from '../types';

export const meta: DemoDefinition = {
	slug: 'situation-room',
	title: 'The Situation Room',
	category: 'ambitious',
	order: 2,
	blurb: 'One sentence in, an audited multi-agent briefing out',
	description: '\'Assess flood exposure for smallholder farms in the lower Zambezi and brief me.\' A planner decomposes the request into retrieval, analysis, cartography, and critique; agents execute against the map; the output is an interactive briefing with linked map states, uncertainty notes, and a full audit trail.',
	usesLlm: true,
	map: {
		camera: {
			center: [
				35.35,
				-17.9
			],
			zoom: 8
		},
		basemap: 'streets'
	},
	status: 'ready'
};
