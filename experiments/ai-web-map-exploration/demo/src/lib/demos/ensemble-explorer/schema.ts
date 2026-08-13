/**
 * Structured decision guidance over a basin's ensemble. The model receives
 * the per-model values and derived stats (nothing else), and must translate
 * disagreement into decision-relevant guidance — separately for portfolio
 * screening and for site commitment.
 */

import type { Schema } from '$lib/llm/types';
import {
	bimodalGap,
	ensembleValues,
	ENSEMBLE_MODELS,
	MODEL_LABELS,
	riskClass,
	SCENARIO_LABELS,
	type EnsembleModel,
	type ScenarioPrefix
} from '../shared/waterRisk';

export interface DivergenceNote {
	model: EnsembleModel;
	position: 'drier' | 'wetter' | 'middle';
	note: string;
}

export interface GuidanceReport {
	headline: string;
	signal_summary: string;
	screening_take: string;
	siting_take: string;
	divergence: DivergenceNote[];
	what_would_resolve: string[];
	confidence: 'high' | 'medium' | 'low';
}

export const GUIDANCE_SCHEMA: Schema = {
	type: 'object',
	required: [
		'headline',
		'signal_summary',
		'screening_take',
		'siting_take',
		'divergence',
		'what_would_resolve',
		'confidence'
	],
	additionalProperties: false,
	properties: {
		headline: { type: 'string', maxLength: 90 },
		signal_summary: { type: 'string', maxLength: 320 },
		screening_take: { type: 'string', maxLength: 320 },
		siting_take: { type: 'string', maxLength: 320 },
		divergence: {
			type: 'array',
			minItems: 2,
			maxItems: 5,
			items: {
				type: 'object',
				required: ['model', 'position', 'note'],
				additionalProperties: false,
				properties: {
					model: { enum: [...ENSEMBLE_MODELS] },
					position: { enum: ['drier', 'wetter', 'middle'] },
					note: { type: 'string', maxLength: 160 }
				}
			}
		},
		what_would_resolve: {
			type: 'array',
			minItems: 1,
			maxItems: 3,
			items: { type: 'string', maxLength: 200 }
		},
		confidence: { enum: ['high', 'medium', 'low'] }
	}
};

export const GUIDANCE_SYSTEM = `You are a water-risk analyst advising a non-hydrologist (a sustainability manager or investor) on how to act on a multi-model ensemble result for one river sub-basin.

Rules:
- Use ONLY the numbers provided. Never invent hydrology, data sources, or values beyond them.
- Distinguish two decision modes explicitly: portfolio SCREENING (is this basin flaggable for review?) and SITING (can capital be committed on this signal alone?).
- If the models split into clusters, say plainly that the ensemble mean is not a value any model predicts.
- The values are on a 0–5 water-stress scale (0 low, 5 extremely high). "drier" means the model sees MORE stress than the ensemble middle, "wetter" means less.
- Respond with JSON only, matching the requested schema.`;

/** compact grounding block embedded in the user message (and reused by the mock) */
export function guidanceContext(props: Record<string, unknown>, prefix: ScenarioPrefix): string {
	const values = ensembleValues(props, prefix);
	const gap = bimodalGap(values);
	const mean = Number(props[`${prefix}_mean`]);
	return JSON.stringify(
		{
			basin: { id: props.id, name: props.name },
			scenario: SCENARIO_LABELS[prefix],
			scale: '0-5 water stress (5 = extremely high)',
			per_model: Object.fromEntries(
				ENSEMBLE_MODELS.map((m) => [MODEL_LABELS[m], values[m]])
			),
			ensemble: {
				mean: mean,
				mean_class: riskClass(mean).label,
				std: props[`${prefix}_std`],
				min: props[`${prefix}_min`],
				max: props[`${prefix}_max`],
				range: props[`${prefix}_range`],
				agreement: props[`${prefix}_agreement`],
				caution_flag: props[`${prefix}_caution`] === 1,
				largest_gap_between_models: Number(gap.gap.toFixed(2))
			},
			note: 'MODELLED demonstration ensemble'
		},
		null,
		1
	);
}
