import type { DemoDefinition } from '../types';

export const meta: DemoDefinition = {
	slug: 'ensemble-explorer',
	title: 'Ensemble Explorer',
	category: 'features',
	order: 8,
	blurb: 'Five models, one map — uncertainty as a first-class surface',
	description:
		'Next-generation water-risk platforms are moving from a single global hydrological model to a ' +
		'multi-model ensemble with explicit uncertainty. This probe renders that uncertainty as UI ' +
		'instead of caveat text: a bivariate choropleth washes risk hues toward neutral where models ' +
		'disagree, cycling single-model views makes divergence visceral, a strip plot exposes basins ' +
		'where the ensemble mean is a value no model actually predicts, and structured guidance ' +
		'translates disagreement into screening-vs-siting decisions. Basin geometries and baseline ' +
		'scores are REAL (public v4 dataset); the 5-model ensemble is MODELLED around them, with ' +
		'model names echoing ISIMIP.',
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
