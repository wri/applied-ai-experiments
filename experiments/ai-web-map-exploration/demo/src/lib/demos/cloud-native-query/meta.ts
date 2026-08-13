import type { DemoDefinition } from '../types';

export const meta: DemoDefinition = {
	slug: 'cloud-native-query',
	title: 'Cloud-Native Query',
	category: 'features',
	order: 5,
	blurb: 'SQL over 10 GB of Overture GeoParquet, straight from the browser',
	description:
		'Natural language becomes constrained SQL (schema-validated, SELECT-only), and DuckDB-WASM runs it directly against Overture Maps GeoParquet on S3 — no server, no download. The bbox column prunes row groups so a city-scale query touches megabytes, not gigabytes; the panel shows exactly what was fetched.',
	usesLlm: true,
	map: { camera: { center: [105.78, 10.03], zoom: 12.5 }, basemap: 'streets' },
	status: 'ready'
};
