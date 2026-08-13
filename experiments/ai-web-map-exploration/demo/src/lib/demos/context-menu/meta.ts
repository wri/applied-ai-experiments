import type { DemoDefinition } from '../types';

export const meta: DemoDefinition = {
	slug: 'context-menu',
	title: 'Context Menu',
	category: 'ui-patterns',
	order: 2,
	blurb: 'Right-click menus that depend on what is under the cursor',
	description: 'Right-click anywhere on the map: the menu is assembled from what is under the cursor — a real Overture place or land-use polygon, the modelled flood band, water, or empty ground — and includes AI-powered options fed by that exact context. Context chips show what the model would see.',
	usesLlm: true,
	map: {
		camera: {
			center: [
				105.746,
				10.045
			],
			zoom: 13
		},
		basemap: 'streets'
	},
	status: 'ready'
};
