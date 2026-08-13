import type { DemoDefinition } from '../types';

export const meta: DemoDefinition = {
	slug: 'command-palette',
	title: 'Command Palette',
	category: 'ui-patterns',
	order: 1,
	blurb: 'Trigger AI-powered map actions from ⌘K',
	description: 'A command palette as the entry point for AI-powered features: registered commands (fly-to, layer toggles, theme) mix with parameterized AI commands, and any unmatched text becomes a context-aware question to the model.',
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
