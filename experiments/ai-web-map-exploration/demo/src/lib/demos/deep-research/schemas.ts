/**
 * Deep-research contracts: a plan of guarded steps (S3 SQL + local-file
 * "API calls"), then a report whose findings must cite executed steps —
 * the citation enum is built at runtime from what actually ran.
 */

import type { Schema } from '$lib/llm/types';

/** The only local datasets a fetch step may name — the demo's "API surface". */
export const FETCH_FILES = ['overture/can-tho-places.geojson', 'can-tho-flood.geojson'] as const;
export type FetchFile = (typeof FETCH_FILES)[number];

export interface ResearchPlanStep {
	id: string;
	kind: 'sql' | 'fetch';
	title: string;
	sql?: string;
	file?: FetchFile;
	rationale?: string;
}

export interface ResearchPlan {
	objective: string;
	steps: ResearchPlanStep[];
}

export const RESEARCH_PLAN_SCHEMA: Schema = {
	type: 'object',
	required: ['objective', 'steps'],
	additionalProperties: false,
	properties: {
		objective: { type: 'string', maxLength: 200 },
		steps: {
			type: 'array',
			minItems: 2,
			maxItems: 5,
			items: {
				type: 'object',
				required: ['id', 'kind', 'title'],
				additionalProperties: false,
				properties: {
					id: { type: 'string', maxLength: 16 },
					kind: { enum: ['sql', 'fetch'] },
					title: { type: 'string', maxLength: 100 },
					sql: { type: 'string', maxLength: 1200 },
					file: { enum: [...FETCH_FILES] },
					rationale: { type: 'string', maxLength: 150 }
				}
			}
		}
	}
};

export interface ReportFinding {
	text: string;
	stepId: string;
	mapState?: { center: [number, number]; zoom: number };
}

export interface ResearchReport {
	title: string;
	summary: string;
	findings: ReportFinding[];
	caveats?: string[];
}

/** stepId is a runtime enum of steps that actually executed — citations must be real. */
export function buildReportSchema(executedStepIds: string[]): Schema {
	return {
		type: 'object',
		required: ['title', 'summary', 'findings'],
		additionalProperties: false,
		properties: {
			title: { type: 'string', maxLength: 90 },
			summary: { type: 'string', maxLength: 400 },
			findings: {
				type: 'array',
				minItems: 2,
				maxItems: 6,
				items: {
					type: 'object',
					required: ['text', 'stepId'],
					additionalProperties: false,
					properties: {
						text: { type: 'string', maxLength: 350 },
						stepId: { enum: executedStepIds },
						mapState: {
							type: 'object',
							required: ['center', 'zoom'],
							additionalProperties: false,
							properties: {
								center: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
								zoom: { type: 'number' }
							}
						}
					}
				}
			},
			caveats: { type: 'array', items: { type: 'string', maxLength: 250 }, maxItems: 3 }
		}
	};
}
