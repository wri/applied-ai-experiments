import type { MockSpec } from '$lib/llm/types';
import { TABLE_TOKEN } from '$lib/data/overtureSql';
import type { ResearchPlan } from './schemas';

/**
 * Mock planner: reads the question and the REAL captured viewport predicate
 * out of the request (same splice trick as cloud-native-query), so keyless
 * mode still executes genuine S3 queries over the user's actual viewport.
 */

function bboxLine(text: string): string {
	const m = text.match(
		/bbox\.xmin BETWEEN [-\d.]+ AND [-\d.]+ AND bbox\.ymin BETWEEN [-\d.]+ AND [-\d.]+/
	);
	return m ? m[0] : 'bbox.xmin BETWEEN 105.68 AND 105.88 AND bbox.ymin BETWEEN 9.98 AND 10.12';
}

export function planMock(): MockSpec {
	return {
		kind: 'fn',
		run: (req) => {
			const text = req.messages
				.map((m) => (typeof m.content === 'string' ? m.content : ''))
				.join(' ');
			const q = text.toLowerCase();
			const where = bboxLine(text);

			let plan: ResearchPlan;
			if (q.includes('flood')) {
				plan = {
					objective:
						'Quantify how commercial activity in the viewport overlaps the modelled flood-risk bands.',
					steps: [
						{
							id: 'places',
							kind: 'sql',
							title: 'Commercial places in view with coordinates',
							sql: `SELECT id, names."primary" AS name, basic_category, confidence,\n  bbox.xmin AS lon, bbox.ymin AS lat\nFROM ${TABLE_TOKEN}\nWHERE ${where}\n  AND basic_category IN ('restaurant', 'coffee_shop', 'hotel', 'fashion_and_apparel_store', 'pharmacy')\nLIMIT 2000`,
							rationale: 'the exposure population'
						},
						{
							id: 'bands',
							kind: 'fetch',
							title: 'Modelled flood-risk bands (API)',
							file: 'can-tho-flood.geojson',
							rationale: 'the hazard surface to intersect against'
						}
					]
				};
			} else if (q.includes('confiden') || q.includes('audit') || q.includes('evidence')) {
				plan = {
					objective: 'Audit data confidence: find the weakest-evidence categories in the viewport.',
					steps: [
						{
							id: 'conf-hist',
							kind: 'sql',
							title: 'Confidence distribution by category',
							sql: `SELECT basic_category, count(*) AS n, round(avg(confidence), 3) AS avg_conf,\n  round(min(confidence), 3) AS min_conf\nFROM ${TABLE_TOKEN}\nWHERE ${where}\nGROUP BY basic_category\nORDER BY avg_conf ASC\nLIMIT 25`,
							rationale: 'which categories carry weak evidence'
						},
						{
							id: 'low-conf',
							kind: 'sql',
							title: 'Lowest-confidence places sample',
							sql: `SELECT id, names."primary" AS name, basic_category, confidence,\n  bbox.xmin AS lon, bbox.ymin AS lat\nFROM ${TABLE_TOKEN}\nWHERE ${where}\n  AND confidence < 0.75\nORDER BY confidence ASC\nLIMIT 300`,
							rationale: 'concrete examples to inspect on the map'
						}
					]
				};
			} else {
				plan = {
					objective:
						'Profile the hospitality economy in view: hotel clusters vs food service, with a registry cross-check.',
					steps: [
						{
							id: 'cat-counts',
							kind: 'sql',
							title: 'Place counts by category',
							sql: `SELECT basic_category, count(*) AS n\nFROM ${TABLE_TOKEN}\nWHERE ${where}\nGROUP BY basic_category\nORDER BY n DESC\nLIMIT 25`,
							rationale: 'the composition baseline'
						},
						{
							id: 'hotels',
							kind: 'sql',
							title: 'Hotels in view',
							sql: `SELECT id, names."primary" AS name, basic_category, confidence,\n  bbox.xmin AS lon, bbox.ymin AS lat\nFROM ${TABLE_TOKEN}\nWHERE ${where}\n  AND basic_category = 'hotel'\nORDER BY confidence DESC\nLIMIT 500`,
							rationale: 'where visitors sleep'
						},
						{
							id: 'food',
							kind: 'sql',
							title: 'Restaurants and cafés in view',
							sql: `SELECT id, names."primary" AS name, basic_category, confidence,\n  bbox.xmin AS lon, bbox.ymin AS lat\nFROM ${TABLE_TOKEN}\nWHERE ${where}\n  AND basic_category IN ('restaurant', 'coffee_shop')\nLIMIT 2000`,
							rationale: 'where visitors eat'
						},
						{
							id: 'registry',
							kind: 'fetch',
							title: 'Committed places extract (API cross-check)',
							file: 'overture/can-tho-places.geojson',
							rationale: 'sanity-check the live S3 numbers against the committed extract'
						}
					]
				};
			}
			return JSON.stringify(plan, null, 2);
		}
	};
}

/** Digest of an executed step, passed to the report mock. */
export interface StepDigest {
	id: string;
	title: string;
	kind: 'sql' | 'fetch';
	status: string;
	source?: string;
	rowCount?: number;
	centroid?: [number, number];
	topRows?: string;
}

export function reportMock(digests: () => StepDigest[]): MockSpec {
	return {
		kind: 'fn',
		run: () => {
			const done = digests().filter((d) => d.status === 'done' || d.status === 'fallback');
			const findings = done.slice(0, 5).map((d) => ({
				text:
					`${d.title}: ${d.rowCount ?? 0} rows` +
					(d.topRows ? ` — leading entries: ${d.topRows}` : '') +
					(d.status === 'fallback' ? ' (canned fallback — the live S3 query failed)' : '') +
					'.',
				stepId: d.id,
				...(d.centroid ? { mapState: { center: d.centroid, zoom: 13.5 } } : {})
			}));
			const caveats = [
				'Overture place confidence is existence confidence, not attribute accuracy.',
				...(done.some((d) => d.status === 'fallback')
					? ['Some steps used canned fallback data because live S3 queries failed.']
					: [])
			];
			return JSON.stringify({
				title: 'Research report (mock synthesis over real query results)',
				summary:
					`${done.length} of ${digests().length} planned steps executed; row counts and samples below come from the actual queries. ` +
					'A live model would narrate patterns; the mock reports the real numbers verbatim.',
				findings,
				caveats
			});
		}
	};
}
