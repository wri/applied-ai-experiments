import type { DemoDefinition } from '../types';

export const meta: DemoDefinition = {
	slug: 'why-this-score',
	title: 'Why This Score?',
	category: 'features',
	order: 9,
	blurb: 'Score decomposition, provenance, and scale-of-use honesty',
	description:
		'The most common confusion with water-risk scores is trust: why is this location high risk, ' +
		'what does a missing value mean, why has nothing changed since last year? This probe makes ' +
		'the score stop being a black box — the weights arithmetic is fully visible and sums to the ' +
		'headline, a narrative explains the drivers at your chosen register (board / analyst / ' +
		'technical), a provenance drawer shows vintage and method per indicator, and the map itself ' +
		'tells you when your zoom exceeds what the data can support. Indicator scores are REAL ' +
		'(public v4 dataset, lower Mekong extract) — including genuinely widespread -9999 no-data.',
	usesLlm: true,
	map: {
		camera: {
			center: [105.65, 9.9],
			zoom: 7.4
		},
		basemap: 'streets'
	},
	status: 'ready'
};
