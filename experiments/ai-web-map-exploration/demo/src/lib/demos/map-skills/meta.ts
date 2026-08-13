import type { DemoDefinition } from '../types';

export const meta: DemoDefinition = {
	slug: 'map-skills',
	title: 'Map Skills',
	category: 'features',
	order: 4,
	blurb: 'skill.md-style workflows executed on a web map',
	description: 'Skills are markdown workflow files with frontmatter: triggers, tool whitelists, procedure. A router picks the right skill for a task, the model plans steps against the skill, and a runner executes them on the map with a step-by-step timeline.',
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
