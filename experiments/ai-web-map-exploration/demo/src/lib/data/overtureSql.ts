/**
 * SQL containment for the cloud-native query demo — the same move as
 * StylePatch, applied to SQL: the model emits a constrained SELECT against a
 * placeholder table token; guards check it in code before anything executes.
 */

import type { Schema } from '$lib/llm/types';

/** Token the model writes as its table; substituted with read_parquet([urls]). */
export const TABLE_TOKEN = '__PLACES__';

export const MAX_LIMIT = 5000;

/** Max bbox edge (degrees) a query may span — keeps row-group reads city-scale. */
export const MAX_BBOX_DEG = 0.5;

export interface NlSql {
	sql: string;
	summary: string;
}

export const NL_SQL_SCHEMA: Schema = {
	type: 'object',
	required: ['sql', 'summary'],
	additionalProperties: false,
	properties: {
		sql: { type: 'string', maxLength: 1200 },
		summary: { type: 'string', maxLength: 200 }
	}
};

/** The schema description the model (and the visitor) sees. */
export const PLACES_SCHEMA_PROMPT = `Table ${TABLE_TOKEN} (Overture Maps places GeoParquet on S3; points):
- id VARCHAR — Overture GERS id
- names.primary VARCHAR — display name (quote "primary": names."primary")
- categories.primary VARCHAR — fine category
- basic_category VARCHAR — coarse category, e.g. 'restaurant', 'coffee_shop', 'hotel', 'pharmacy', 'school', 'fashion_and_apparel_store'
- confidence DOUBLE — 0..1 existence confidence
- bbox.xmin/bbox.ymin DOUBLE — for points these are the lon/lat; ALWAYS alias as lon/lat when selecting locations
Rules: ONE SELECT statement, no semicolons or DDL. FROM ${TABLE_TOKEN} only.
ALWAYS include the viewport predicate: bbox.xmin BETWEEN <w> AND <e> AND bbox.ymin BETWEEN <s> AND <n> (this is what prunes row groups).
ALWAYS include LIMIT (max ${MAX_LIMIT}).`;

export interface Bbox {
	w: number;
	s: number;
	e: number;
	n: number;
}

/** Clamp a viewport bbox to MAX_BBOX_DEG per edge, centered. */
export function clampBbox(b: Bbox): { bbox: Bbox; clamped: boolean } {
	const cx = (b.w + b.e) / 2;
	const cy = (b.s + b.n) / 2;
	const halfW = Math.min((b.e - b.w) / 2, MAX_BBOX_DEG / 2);
	const halfH = Math.min((b.n - b.s) / 2, MAX_BBOX_DEG / 2);
	const clamped = halfW < (b.e - b.w) / 2 || halfH < (b.n - b.s) / 2;
	return {
		bbox: {
			w: Number((cx - halfW).toFixed(4)),
			e: Number((cx + halfW).toFixed(4)),
			s: Number((cy - halfH).toFixed(4)),
			n: Number((cy + halfH).toFixed(4))
		},
		clamped
	};
}

const FORBIDDEN =
	/\b(insert|update|delete|create|drop|alter|attach|detach|copy|install|load|pragma|set|call|export|import)\b/i;

/** Semantic guard: returns human-readable violations (empty = safe to run). */
export function sqlGuardErrors(sql: string): string[] {
	const errors: string[] = [];
	const trimmed = sql.trim();
	if (!/^select\b/i.test(trimmed)) errors.push('must be a single SELECT statement');
	if (trimmed.includes(';')) errors.push('semicolons are not allowed');
	if (FORBIDDEN.test(trimmed)) errors.push('only read-only SELECT syntax is allowed');
	if (!trimmed.includes(TABLE_TOKEN)) errors.push(`must query the ${TABLE_TOKEN} table token`);
	if (!/bbox\.xmin/i.test(trimmed)) {
		errors.push('must include the bbox.xmin/bbox.ymin viewport predicate (row-group pruning)');
	}
	const limit = trimmed.match(/\blimit\s+(\d+)/i);
	if (!limit) errors.push(`must include LIMIT (max ${MAX_LIMIT})`);
	else if (Number(limit[1]) > MAX_LIMIT) errors.push(`LIMIT must be ≤ ${MAX_LIMIT}`);
	return errors;
}

/** Substitute the table token with the real read_parquet call. */
export function resolveSql(sql: string, partUrls: string[]): string {
	const table = `read_parquet([${partUrls.map((u) => `'${u}'`).join(', ')}])`;
	return sql.replaceAll(TABLE_TOKEN, table);
}

/** Per-file spatial extent, precomputed at extract time (inventory.json). */
export interface FileExtent {
	file: string;
	xmin: number;
	xmax: number;
	ymin: number;
	ymax: number;
}

/**
 * File-level pruning: drop whole part files whose extent cannot intersect the
 * query bbox — before DuckDB ever runs. Parquet row-group pruning still needs
 * a footer read per file (tens of MB each over the network), and scanning all
 * 16 remote files at once also overruns the wasm32 heap; this cut is what
 * makes the browser query practical. Files without an extent record are kept.
 */
export function pruneParts(
	urls: string[],
	extents: FileExtent[],
	bbox: Bbox
): { kept: string[]; dropped: number } {
	const byFile = new Map(extents.map((e) => [e.file, e]));
	const kept = urls.filter((u) => {
		const e = byFile.get(u.split('/').pop() ?? '');
		if (!e) return true;
		return e.xmax >= bbox.w && e.xmin <= bbox.e && e.ymax >= bbox.s && e.ymin <= bbox.n;
	});
	return { kept, dropped: urls.length - kept.length };
}
