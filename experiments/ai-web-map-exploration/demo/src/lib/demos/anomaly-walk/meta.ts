import type { DemoDefinition } from '../types';

export const meta: DemoDefinition = {
	slug: 'anomaly-walk',
	title: 'Anomaly Walk',
	category: 'features',
	order: 6,
	blurb: 'Show me the five weirdest things in view — then walk me through them',
	description:
		'Outlier detection runs in code (z-scores over change activity and embedding position, per category); the model only picks and explains the top anomalies from the pre-computed candidates. The result is a guided flyover: the camera visits each stop with a narration card. The probe is the division of labor — statistics detect, the model narrates, the map performs.',
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
