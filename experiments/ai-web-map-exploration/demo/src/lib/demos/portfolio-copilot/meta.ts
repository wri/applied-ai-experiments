import type { DemoDefinition } from '../types';

export const meta: DemoDefinition = {
	slug: 'portfolio-copilot',
	title: 'Portfolio Copilot',
	category: 'features',
	order: 7,
	blurb: 'Drop a messy CSV — AI repairs it, code screens it, answers cite basins',
	description:
		'Bulk portfolio screening against real water-risk sub-basins. The single most-reported pain ' +
		'with risk tools is broken file upload — swapped coordinates, DMS strings, decimal commas, ' +
		'mojibake. Here the model repairs the defective rows and shows every change for per-row ' +
		'accept/reject (deterministic code handles duplicates and flags what to send); ' +
		'point-in-polygon screening and portfolio stats are pure code; and questions are answered ' +
		'over those computed stats only, with citations that fly to basins. Basin scores are REAL ' +
		'(public v4 dataset); the sample portfolio is fictional.',
	usesLlm: true,
	map: {
		camera: {
			center: [105.65, 9.9],
			zoom: 7.2
		},
		basemap: 'streets'
	},
	status: 'ready'
};
