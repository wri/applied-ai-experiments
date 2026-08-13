import type { MockSpec } from '$lib/llm/types';
import { TABLE_TOKEN } from '$lib/data/overtureSql';

/**
 * Canned NL→SQL parses. The fn-mock reads the viewport bbox out of the request
 * text (the demo always includes it), so the mocked SQL carries the user's
 * REAL viewport — and the query genuinely executes against S3 even keyless.
 */

function bboxFrom(text: string): { w: string; s: string; e: string; n: string } {
	const m = text.match(
		/bbox\.xmin BETWEEN ([-\d.]+) AND ([-\d.]+) AND bbox\.ymin BETWEEN ([-\d.]+) AND ([-\d.]+)/
	);
	return m
		? { w: m[1], e: m[2], s: m[3], n: m[4] }
		: { w: '105.68', e: '105.88', s: '9.98', n: '10.12' };
}

export function nlSqlMock(): MockSpec {
	return {
		kind: 'fn',
		run: (req) => {
			const text = req.messages
				.map((m) => (typeof m.content === 'string' ? m.content : ''))
				.join(' ');
			const q = text.toLowerCase();
			const b = bboxFrom(text);
			const where = `bbox.xmin BETWEEN ${b.w} AND ${b.e} AND bbox.ymin BETWEEN ${b.s} AND ${b.n}`;

			let sql: string;
			let summary: string;
			if (q.includes('count') || q.includes('categor')) {
				sql = `SELECT basic_category, count(*) AS n\nFROM ${TABLE_TOKEN}\nWHERE ${where}\nGROUP BY basic_category\nORDER BY n DESC\nLIMIT 25`;
				summary = 'Counts places in the current viewport grouped by coarse category.';
			} else if (q.includes('pharmac')) {
				sql = `SELECT id, names."primary" AS name, basic_category, confidence,\n  bbox.xmin AS lon, bbox.ymin AS lat\nFROM ${TABLE_TOKEN}\nWHERE ${where}\n  AND basic_category = 'pharmacy'\n  AND confidence >= 0.8\nORDER BY confidence DESC\nLIMIT 500`;
				summary = 'High-confidence pharmacies in the current viewport, most confident first.';
			} else if (q.includes('hotel')) {
				sql = `SELECT id, names."primary" AS name, basic_category, confidence,\n  bbox.xmin AS lon, bbox.ymin AS lat\nFROM ${TABLE_TOKEN}\nWHERE ${where}\n  AND basic_category = 'hotel'\nORDER BY confidence DESC\nLIMIT 1000`;
				summary = 'Hotels in the current viewport.';
			} else {
				sql = `SELECT id, names."primary" AS name, basic_category, confidence,\n  bbox.xmin AS lon, bbox.ymin AS lat\nFROM ${TABLE_TOKEN}\nWHERE ${where}\n  AND basic_category IN ('restaurant', 'casual_eatery', 'cafe', 'coffee_shop')\nLIMIT 2000`;
				summary = 'Restaurants, eateries and cafés in the current viewport.';
			}
			return JSON.stringify({ sql, summary }, null, 2);
		}
	};
}

export const SUGGESTIONS = [
	'Restaurants and cafés in view',
	'Count places by category',
	'High-confidence pharmacies'
];
