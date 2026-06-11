// Curated example documents that load with one click. The PDF is fetched
// directly from its URL and parsed in the browser (same path as the "load your
// own URL" field) — nothing is bundled. URLs must be reachable cross-origin
// (the host must send Access-Control-Allow-Origin); some hosts don't.

export interface ExampleDoc {
	label: string;
	url: string;
	description: string;
	pages: number;
	suggestedQueries: string[];
}

export const EXAMPLE_DOCS: ExampleDoc[] = [
	{
		label: 'WRI: Places to Watch — forest disturbance alerts',
		url: 'https://files.wri.org/d8/s3fs-public/2026-04/places-to-watch-identifying-high-priority-forest-disturbance-from-near-real-time-satellite-data.pdf',
		description: 'Technical note on prioritizing near-real-time deforestation alerts from satellite data.',
		pages: 17,
		suggestedQueries: [
			'how are deforestation alerts prioritized',
			'what causes alert saturation',
			'satellite systems used to detect forest loss',
			'filtering near-real-time disturbance alerts'
		]
	},
	{
		label: 'WRI: Electric school bus adoption dataset',
		url: 'https://files.wri.org/d8/s3fs-public/2026-05/26_tech_esb-adoption_version-10.pdf',
		description: 'Technical note on building a U.S. dataset that tracks electric school bus adoption.',
		pages: 18,
		suggestedQueries: [
			'how is electric school bus adoption tracked',
			'what counts as a committed ESB',
			'funding sources for electric school buses',
			'is the transition to ESBs happening equitably'
		]
	}
];
