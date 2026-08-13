import type { DemoDefinition } from '../types';

export const meta: DemoDefinition = {
	slug: 'explain-view',
	title: 'Explain This View',
	category: 'features',
	order: 3,
	blurb: 'Screenshot the viewport, ask a multimodal model what it sees',
	description: 'The current viewport is captured from the map canvas, paired with the context snapshot, and sent to a multimodal model — with levers for verbosity, confidence framing, focus, and audience. The captured image is always shown, keeping the pipeline legible.',
	usesLlm: true,
	map: {
		camera: {
			center: [
				105.746,
				10.045
			],
			zoom: 13
		},
		basemap: 'satellite'
	},
	status: 'ready'
};
