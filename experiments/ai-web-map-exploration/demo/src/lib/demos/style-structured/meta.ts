import type { DemoDefinition } from '../types';

export const meta: DemoDefinition = {
	slug: 'style-structured',
	title: 'Style from Structured Output',
	category: 'ui-patterns',
	order: 6,
	blurb: 'LLM emits a constrained style patch, validated then applied',
	description: 'The model never writes raw style JSON. It emits a whitelisted StylePatch (setPaint / setFilter / setLayout ops on known layers), which is schema-validated, semantically checked, repaired if broken, previewed as a diff, and applied with revert.',
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
