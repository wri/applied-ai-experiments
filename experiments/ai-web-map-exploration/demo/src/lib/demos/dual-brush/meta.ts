import type { DemoDefinition } from '../types';

export const meta: DemoDefinition = {
	slug: 'dual-brush',
	title: 'Dual Brush',
	category: 'ui-patterns',
	order: 5,
	blurb: 'Brush an embeddings scatterplot ↔ filter the map',
	description: 'Points live in two spaces at once: geographic and embedding. Brush the scatterplot to highlight locations on the map; drag a box on the map (or just move the viewport) to select points in embedding space.',
	usesLlm: false,
	map: {
		camera: {
			center: [
				105.75,
				10.05
			],
			zoom: 11.5
		},
		basemap: 'streets'
	},
	status: 'ready'
};
