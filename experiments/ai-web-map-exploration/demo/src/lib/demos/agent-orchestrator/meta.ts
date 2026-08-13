import type { DemoDefinition } from '../types';

export const meta: DemoDefinition = {
	slug: 'agent-orchestrator',
	title: 'Agent Orchestrator',
	category: 'ambitious',
	order: 1,
	blurb: 'Map view ↔ kanban for agents and their geospatial assets',
	description: 'A map-forward agent orchestrator: switch between a kanban of agent tasks and a map of their areas of interest and produced assets. Selection and state flow between both views, produced artifacts are first-class inspectable objects (map-state assets apply/revert on the live map), dependency edges light up as work hands off, and mid-run the critique agent visibly bounces a task back for rework. The probe is whether agents and geospatial artifacts can share one seamless surface.',
	usesLlm: false,
	map: {
		camera: {
			center: [
				35.35,
				-17.9
			],
			zoom: 8
		},
		basemap: 'streets'
	},
	status: 'ready'
};
