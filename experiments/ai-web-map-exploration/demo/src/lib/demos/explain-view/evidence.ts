/**
 * Pointable evidence: alongside prose, the model returns claims anchored to
 * image-space bounding boxes — "trust me" text becomes verifiable, spatially
 * addressed statements the user can check against the pixels (and the map).
 */

import type { Schema } from '$lib/llm/types';
import type { MockSpec } from '$lib/llm/types';

export interface EvidenceClaim {
	text: string;
	/** [x0, y0, x1, y1] in 0–1 normalized image coordinates (origin top-left) */
	bbox: [number, number, number, number];
	confidence: 'high' | 'medium' | 'low';
}

export interface Evidence {
	claims: EvidenceClaim[];
}

/**
 * Confidence → color, shared by the thumbnail overlay and the map layers.
 * Literal hexes matching the status text tokens — map paint can't read CSS vars.
 */
export const CONFIDENCE_COLORS: Record<EvidenceClaim['confidence'], string> = {
	high: '#4ade80',
	medium: '#fbbf24',
	low: '#f87171'
};

export const EVIDENCE_SCHEMA: Schema = {
	type: 'object',
	required: ['claims'],
	additionalProperties: false,
	properties: {
		claims: {
			type: 'array',
			minItems: 1,
			maxItems: 5,
			items: {
				type: 'object',
				required: ['text', 'bbox', 'confidence'],
				additionalProperties: false,
				properties: {
					text: { type: 'string', maxLength: 200 },
					bbox: {
						type: 'array',
						minItems: 4,
						maxItems: 4,
						items: { type: 'number', minimum: 0, maximum: 1 }
					},
					confidence: { enum: ['high', 'medium', 'low'] }
				}
			}
		}
	}
};

export const EVIDENCE_SYSTEM =
	'You are given a screenshot of a map viewport. Return up to 5 visually-checkable claims, ' +
	'each anchored to the image region that supports it. bbox is [x0, y0, x1, y1] in normalized ' +
	'0-1 image coordinates with origin at the TOP-LEFT. Boxes must tightly cover the evidence, ' +
	'not the whole frame. Confidence reflects what the pixels alone can support.';

/**
 * Plausible fixed boxes for the default explain-view camera (Cần Thơ at z13,
 * satellite): approximate on purpose — the pipeline is the point, and the boxes
 * are the artifact the user is invited to check against the pixels.
 */
export function evidenceMock(): MockSpec {
	const canned: Evidence = {
		claims: [
			{
				text: 'A major river channel (the Hậu) crosses the lower half of the frame as a broad, sediment-toned band.',
				bbox: [0.0, 0.45, 0.85, 0.95],
				confidence: 'high'
			},
			{
				text: 'Dense urban fabric — fine-grained rooftops along shophouse blocks — fills the near bank around the frame center.',
				bbox: [0.35, 0.15, 0.8, 0.5],
				confidence: 'high'
			},
			{
				text: 'A regular canal-and-field pattern in the upper left reads as active cultivation (paddy or orchard rows).',
				bbox: [0.02, 0.02, 0.35, 0.4],
				confidence: 'medium'
			},
			{
				text: 'Bright linear feature parallel to the river bank is consistent with a levee road or embankment.',
				bbox: [0.15, 0.4, 0.7, 0.55],
				confidence: 'low'
			}
		]
	};
	return { kind: 'json', value: canned };
}
