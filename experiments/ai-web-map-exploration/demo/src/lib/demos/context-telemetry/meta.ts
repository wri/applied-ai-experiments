import type { DemoDefinition } from '../types';

export const meta: DemoDefinition = {
	slug: 'context-telemetry',
	title: 'Context Telemetry',
	category: 'ui-patterns',
	order: 4,
	blurb: 'Everything the app knows right now, organized for review',
	description: 'A live, complete view of the context available to AI features: viewport, layers, features in view, browser environment, session — plus candidate enrichment sources. The design probe: what could we feed a model, and what does it cost in tokens?',
	usesLlm: true,
	map: {
		camera: {
			center: [
				105.746,
				10.045
			],
			zoom: 12.5
		},
		basemap: 'streets'
	},
	status: 'ready'
};
