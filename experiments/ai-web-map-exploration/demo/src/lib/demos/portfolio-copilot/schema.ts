/**
 * Runtime-built repair schema (enums over the file's real headers and the
 * actually-flagged row ids, so the model cannot invent rows), the repair
 * prompt contract, and the PortfolioStats grounding object for Q&A.
 */

import type { Schema } from '$lib/llm/types';
import type { CsvRow } from './csv';

export interface ColumnMapping {
	name: string | null;
	lat: string | null;
	lon: string | null;
	country: string | null;
	sector: string | null;
}

export interface RowChange {
	field: 'lat' | 'lon' | 'name' | 'country' | 'sector';
	from: string;
	to: string;
	reason: string;
}

export interface RowRepair {
	rowId: number;
	disposition: 'ok' | 'repaired' | 'needs-review';
	repairedLat?: number;
	repairedLon?: number;
	repairedName?: string;
	changes?: RowChange[];
	reviewReason?: string;
}

export interface RepairResult {
	mapping: ColumnMapping;
	rows: RowRepair[];
}

export function buildRepairSchema(headers: string[], flaggedIds: number[]): Schema {
	const headerEnum = { enum: [...headers, null] };
	return {
		type: 'object',
		required: ['mapping', 'rows'],
		additionalProperties: false,
		properties: {
			mapping: {
				type: 'object',
				required: ['name', 'lat', 'lon', 'country', 'sector'],
				additionalProperties: false,
				properties: {
					name: headerEnum,
					lat: headerEnum,
					lon: headerEnum,
					country: headerEnum,
					sector: headerEnum
				}
			},
			rows: {
				type: 'array',
				maxItems: Math.max(1, flaggedIds.length),
				items: {
					type: 'object',
					required: ['rowId', 'disposition'],
					additionalProperties: false,
					properties: {
						rowId: { enum: flaggedIds.length ? flaggedIds : [-1] },
						disposition: { enum: ['ok', 'repaired', 'needs-review'] },
						repairedLat: { type: 'number', minimum: -90, maximum: 90 },
						repairedLon: { type: 'number', minimum: -180, maximum: 180 },
						repairedName: { type: 'string', maxLength: 80 },
						changes: {
							type: 'array',
							maxItems: 4,
							items: {
								type: 'object',
								required: ['field', 'from', 'to', 'reason'],
								additionalProperties: false,
								properties: {
									field: { enum: ['lat', 'lon', 'name', 'country', 'sector'] },
									from: { type: 'string', maxLength: 60 },
									to: { type: 'string', maxLength: 60 },
									reason: { type: 'string', maxLength: 120 }
								}
							}
						},
						reviewReason: { type: 'string', maxLength: 160 }
					}
				}
			}
		}
	};
}

export const REPAIR_SYSTEM = `You repair a defective site-portfolio CSV for water-risk screening in the lower Mekong region (roughly lon 102–112, lat 6–24).

Target fields: name, lat (decimal degrees), lon (decimal degrees), country (optional), sector (optional).

Rules:
- First map the file's columns to the target fields (mapping); use null when a field has no column.
- For each flagged row decide: 'ok' (nothing actually wrong), 'repaired' (you are confident in the fix), or 'needs-review' (do not guess).
- Repairs you may make: swapped lat/lon, degrees-minutes-seconds → decimal, decimal commas → points, mojibake (UTF-8 read as Latin-1) in names.
- NEVER invent coordinates. A row with missing coordinates is 'needs-review', not 'repaired'.
- Every 'repaired' row must list its changes with a short reason, and include repairedLat/repairedLon when coordinates changed.
- Respond with JSON only, matching the requested schema.`;

/** the user message the repair call (and its mock) both parse */
export function buildRepairPrompt(
	headers: string[],
	cleanExamples: CsvRow[],
	flagged: CsvRow[]
): string {
	return [
		`HEADERS: ${JSON.stringify(headers)}`,
		`CLEAN EXAMPLES: ${JSON.stringify(cleanExamples.slice(0, 3))}`,
		`FLAGGED ROWS: ${JSON.stringify(flagged)}`,
		'',
		'Map the columns and repair or flag each row.'
	].join('\n');
}

// ---------- portfolio stats (the Q&A grounding object) ----------

export interface BasinStat {
	basinId: string;
	name: string;
	siteCount: number;
	overall: number;
	classLabel: string;
	worstIndicators: { code: string; label: string; score: number }[];
	sectors: Record<string, number>;
}

export interface PortfolioStats {
	totalRows: number;
	screenedSites: number;
	noCoverageSites: number;
	excluded: { needsReview: number; rejectedRepairs: number; duplicates: number };
	sitesByClass: Record<string, number>;
	topBasins: BasinStat[];
	sectorBreakdown: Record<string, { sites: number; avgScore: number }>;
	notes: string[];
}

export const QA_RULES = `You answer questions about a screened site portfolio.

Hard rules:
- Answer ONLY from the PORTFOLIO STATS JSON below. If the answer is not derivable from it, say so plainly.
- Cite basins inline as [[basin:ID]] using ONLY basinId values present in topBasins. Place the marker right after the first mention of that basin.
- Sites with "no coverage" fall outside the basin dataset — never silently ignore them; they are unscreened, not safe.
- Basin scores are from a real public water-risk dataset (v4, 2023); the aggregation weights are demo defaults.
- Keep answers short: 2–6 sentences, markdown allowed, no headings.`;

export function buildQaSystem(stats: PortfolioStats): string {
	return `${QA_RULES}\n\nPORTFOLIO STATS:\n${JSON.stringify(stats)}`;
}
