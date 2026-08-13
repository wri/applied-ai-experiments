import type { DemoDefinition } from '../types';

export const meta: DemoDefinition = {
	slug: 'query-viewport',
	title: 'Query to Viewport',
	category: 'features',
	order: 2,
	blurb: 'A sentence becomes camera + filters + style + legend + URL',
	description: '\'Show farmland in the high flood-risk bands in Can Tho.\' The model parses intent into spatial filters over real Overture layers, flies the camera, applies the style, drops a legend — and the URL captures all of it, shareable and reproducible.',
	usesLlm: true,
	map: {
		camera: {
			center: [
				105.746,
				10.045
			],
			zoom: 12
		},
		basemap: 'streets'
	},
	status: 'ready'
};
