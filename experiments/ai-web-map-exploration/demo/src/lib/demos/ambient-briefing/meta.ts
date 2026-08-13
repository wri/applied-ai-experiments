import type { DemoDefinition } from '../types';

export const meta: DemoDefinition = {
	slug: 'ambient-briefing',
	title: 'Ambient Briefing',
	category: 'features',
	order: 1,
	blurb: 'What changed since you last looked, with tap-to-verify flyovers',
	description: 'Open the map and it tells you what changed in your saved regions since your last visit — a two-sentence briefing with citations that fly the camera to the evidence. The atlas remembers you.',
	usesLlm: true,
	map: {
		camera: {
			center: [
				70,
				-4
			],
			zoom: 2
		},
		basemap: 'streets'
	},
	status: 'ready'
};
