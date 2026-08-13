/**
 * Prompts + schema for the two LLM surfaces: the streamed driver narrative
 * (per audience register) and the structured local-validation checklist.
 */

import type { Schema } from '$lib/llm/types';
import { INDICATORS } from '../shared/waterRisk';

export type Audience = 'board' | 'analyst' | 'technical';

export const AUDIENCES: { id: Audience; label: string }[] = [
	{ id: 'board', label: 'board' },
	{ id: 'analyst', label: 'analyst' },
	{ id: 'technical', label: 'technical' }
];

export const AUDIENCE_PROMPTS: Record<Audience, string> = {
	board:
		'Audience: a company board with no water expertise. Two to three short sentences. Bottom line first: the class, the single biggest driver, and what kind of action it implies. No indicator codes, no arithmetic.',
	analyst:
		'Audience: a sustainability analyst. One tight paragraph. Name the top 2–3 drivers with their actual values and contributions from the arithmetic, note anything excluded for missing data, and say what the score does NOT capture.',
	technical:
		'Audience: a technical reviewer. Walk the arithmetic: group weights, renormalization if any indicator is missing, the dominant contributions with numbers, and the provenance (method, vintage, resolution) of each driver. Flag stale inputs explicitly.'
};

export const NARRATIVE_SYSTEM = `You explain a water-risk score decomposition to a specific audience.

Hard rules:
- Cite ONLY numbers present in the decomposition below. Never invent values, sources, or hydrology.
- If an indicator shows NO DATA, say explicitly that it means insufficient data, not zero risk, and that weights were renormalized around it.
- If the basin is flagged STALE, lead with why the score has not moved (that is what the user is confused about).
- These are MODELLED demonstration values; do not present them as real-world measurements.
- Plain prose only, no headings or lists unless the audience instruction asks for structure.`;

export interface ChecklistItem {
	driver: string;
	action: string;
	who: string;
	rationale: string;
	effort: 'desk' | 'field' | 'agency-contact';
}

export interface ChecklistResult {
	items: ChecklistItem[];
}

export const CHECKLIST_SCHEMA: Schema = {
	type: 'object',
	required: ['items'],
	additionalProperties: false,
	properties: {
		items: {
			type: 'array',
			minItems: 3,
			maxItems: 6,
			items: {
				type: 'object',
				required: ['driver', 'action', 'who', 'rationale', 'effort'],
				additionalProperties: false,
				properties: {
					driver: { enum: [...INDICATORS.map((d) => d.code), 'general'] },
					action: { type: 'string', maxLength: 160 },
					who: { type: 'string', maxLength: 80 },
					rationale: { type: 'string', maxLength: 200 },
					effort: { enum: ['desk', 'field', 'agency-contact'] }
				}
			}
		}
	}
};

export const CHECKLIST_SYSTEM = `You turn a water-risk score decomposition into a local-validation checklist: the concrete things a project team should verify on the ground BEFORE acting on this screening-level score.

Rules:
- Key each item to one of the dominant drivers (use its indicator code) or 'general'.
- Actions must be verifiable steps a team could actually take locally (records to obtain, offices to contact, measurements to make) — not vague "investigate further".
- The rationale must tie back to the decomposed value or its provenance (vintage, resolution, method).
- Respond with JSON only, matching the requested schema.`;
