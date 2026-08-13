import type { DemoDefinition } from '../types';

export const meta: DemoDefinition = {
	slug: 'deep-research',
	title: 'Deep Research',
	category: 'ambitious',
	order: 4,
	blurb: 'Ask a question, keep exploring — a background agent queries S3 and files a cited report',
	description:
		'A deep-research agent for the map: it plans a small run, then executes real work in the background — guarded DuckDB-WASM SQL against Overture GeoParquet on S3 plus local dataset fetches as "API calls" — while you keep panning, or leave the demo entirely. When it finishes, a toast delivers a report whose every finding cites the exact query that produced it, with restorable map states. The probe is trust in an agent you did not watch work.',
	usesLlm: true,
	map: {
		camera: {
			center: [105.78, 10.03],
			zoom: 12.5
		},
		basemap: 'streets'
	},
	status: 'ready'
};
