import type { DemoDefinition } from '../types';

export const meta: DemoDefinition = {
	slug: 'legend-surface',
	title: 'Legend as Surface',
	category: 'ui-patterns',
	order: 3,
	blurb: 'The legend as an interaction and AI query surface',
	description: 'The legend stops being a static key: classes toggle filters, hover emphasizes, each row carries an ask-affordance, and a natural-language restyle box turns intent into a validated legend spec applied to the layer.',
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
