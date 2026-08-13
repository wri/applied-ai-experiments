/**
 * The deep-research agent — a module-level singleton so a run genuinely
 * continues while the user pans, opens other panels, or leaves the demo
 * entirely. The Demo component only renders this state; map layers derive
 * from it declaratively, so they survive demo remounts. Completion lands as
 * a global toast wherever the user is.
 */

import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { loadData } from '$lib/data/load';
import { listParquetParts } from '$lib/data/overture';
import {
	clampBbox,
	PLACES_SCHEMA_PROMPT,
	pruneParts,
	resolveSql,
	sqlGuardErrors,
	type Bbox,
	type FileExtent
} from '$lib/data/overtureSql';
import { llm } from '$lib/llm/provider.svelte';
import { StructuredOutputError } from '$lib/llm/structured';
import { toasts } from '$lib/ui/toast.svelte';
import { planMock, reportMock, type StepDigest } from './mocks';
import { cannedFallback } from './fallback';
import {
	buildReportSchema,
	FETCH_FILES,
	RESEARCH_PLAN_SCHEMA,
	type ResearchPlan,
	type ResearchReport
} from './schemas';

export type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'fallback';

export interface ResearchStep {
	id: string;
	kind: 'sql' | 'fetch';
	title: string;
	sql?: string;
	file?: string;
	rationale?: string;
	status: StepStatus;
	rowCount?: number;
	ms?: number;
	rows?: Record<string, unknown>[];
	points?: GeoJSON.FeatureCollection;
	error?: string;
	source?: 'duckdb-s3' | 'static-file' | 'canned';
}

export type ResearchStatus = 'idle' | 'planning' | 'running' | 'synthesizing' | 'done' | 'error';

interface Inventory {
	release: string;
	places_file_extents: FileExtent[];
}

const KEPT_ROWS = 100;

export class ResearchAgent {
	status = $state<ResearchStatus>('idle');
	question = $state('');
	objective = $state('');
	steps = $state<ResearchStep[]>([]);
	report = $state<ResearchReport | null>(null);
	reportOpen = $state(false);
	error = $state<string | null>(null);
	elapsed = $state(0);
	bbox = $state<Bbox | null>(null);
	bboxClamped = $state(false);

	private gen = 0;
	private timer: ReturnType<typeof setInterval> | null = null;
	private partUrls: string[] | null = null;

	get running(): boolean {
		return this.status === 'planning' || this.status === 'running' || this.status === 'synthesizing';
	}

	get currentStepIndex(): number {
		return this.steps.findIndex((s) => s.status === 'running');
	}

	cancel(): void {
		this.gen++;
		this.stopTimer();
		this.status = 'idle';
		this.steps = [];
		this.report = null;
		this.reportOpen = false;
		this.error = null;
	}

	async start(question: string, rawBbox: Bbox): Promise<void> {
		if (this.running) return;
		const gen = ++this.gen;
		this.question = question;
		this.report = null;
		this.reportOpen = false;
		this.error = null;
		this.steps = [];
		this.objective = '';
		this.elapsed = 0;
		this.status = 'planning';
		const t0 = performance.now();
		this.stopTimer();
		this.timer = setInterval(() => {
			this.elapsed = Math.round((performance.now() - t0) / 1000);
		}, 1000);

		// the run works against the viewport captured at start — it must not
		// chase the camera while the user keeps exploring
		const { bbox, clamped } = clampBbox(rawBbox);
		this.bbox = bbox;
		this.bboxClamped = clamped;
		const where = `bbox.xmin BETWEEN ${bbox.w} AND ${bbox.e} AND bbox.ymin BETWEEN ${bbox.s} AND ${bbox.n}`;

		try {
			// --- plan ---
			const planRes = await llm.structured<ResearchPlan>(
				{
					system:
						'You plan a small research run over geospatial data. Decompose the question into 2-5 steps.\n' +
						`sql steps: ONE guarded SELECT each.\n${PLACES_SCHEMA_PROMPT}\n` +
						`fetch steps ("API calls") may ONLY name one of: ${FETCH_FILES.join(', ')}.\n` +
						'Steps run sequentially in the background; findings must be checkable against step outputs.',
					messages: [
						{
							role: 'user',
							content: `Question: ${question}\n\nCurrent viewport predicate (use it verbatim in every sql step): ${where}`
						}
					],
					maxTokens: 1400,
					mock: planMock()
				},
				RESEARCH_PLAN_SCHEMA
			);
			if (gen !== this.gen) return;

			this.objective = planRes.value.objective;
			this.steps = planRes.value.steps.map((s): ResearchStep => {
				const guardErrors = s.kind === 'sql' ? sqlGuardErrors(s.sql ?? '') : [];
				const missing =
					(s.kind === 'sql' && !s.sql) || (s.kind === 'fetch' && !s.file)
						? ['step is missing its sql/file payload']
						: [];
				const errors = [...missing, ...guardErrors];
				return {
					id: s.id,
					kind: s.kind,
					title: s.title,
					sql: s.sql,
					file: s.file,
					rationale: s.rationale,
					status: errors.length ? 'error' : 'pending',
					error: errors.length ? `blocked by guards: ${errors.join('; ')}` : undefined
				};
			});

			// --- execute ---
			this.status = 'running';
			for (const step of this.steps) {
				if (gen !== this.gen) return;
				if (step.status !== 'pending') continue;
				await this.runStep(step, gen);
			}
			if (gen !== this.gen) return;

			const executed = this.steps.filter((s) => s.status === 'done' || s.status === 'fallback');
			if (!executed.length) {
				throw new Error('every research step failed — nothing to synthesize');
			}

			// --- synthesize ---
			this.status = 'synthesizing';
			const digest = executed
				.map(
					(s) =>
						`step ${s.id} (${s.kind}, ${s.source}): ${s.title}\n` +
						(s.sql ? `sql: ${s.sql}\n` : `file: ${s.file}\n`) +
						`rows: ${s.rowCount}\nsample: ${JSON.stringify((s.rows ?? []).slice(0, 8))}`
				)
				.join('\n\n');
			const reportRes = await llm.structured<ResearchReport>(
				{
					system:
						'You write a short research report from executed data steps. Every finding must cite the ' +
						'stepId whose output supports it, report only numbers present in the digests, and add a ' +
						'mapState (center [lon,lat] + zoom) when a finding is about a place pattern.',
					messages: [
						{ role: 'user', content: `Question: ${this.question}\n\nExecuted steps:\n${digest}` }
					],
					maxTokens: 1400,
					mock: reportMock(() => this.digests())
				},
				buildReportSchema(executed.map((s) => s.id))
			);
			if (gen !== this.gen) return;

			this.report = reportRes.value;
			this.status = 'done';
			this.reportOpen = true;
			this.stopTimer();
			toasts.push({
				title: 'Research complete',
				body: this.report.title,
				tone: 'info',
				actions: [
					{
						label: 'open report',
						run: () => {
							this.reportOpen = true;
							goto(`${base}/deep-research`);
						}
					}
				]
			});
		} catch (e) {
			if (gen !== this.gen) return;
			this.stopTimer();
			this.status = 'error';
			this.error =
				e instanceof StructuredOutputError
					? `structured output failed: ${e.validationErrors.join('; ')}`
					: (e as Error).message;
			toasts.push({ title: 'Research failed', body: this.error, tone: 'error' });
		}
	}

	private async runStep(step: ResearchStep, gen: number): Promise<void> {
		this.patch(step.id, { status: 'running' });
		const t0 = performance.now();
		try {
			if (step.kind === 'fetch') {
				const data = await loadData<GeoJSON.FeatureCollection>(step.file!);
				if (gen !== this.gen) return;
				const rows = data.features.slice(0, KEPT_ROWS).map((f) => ({
					...(f.properties ?? {})
				}));
				this.patch(step.id, {
					status: 'done',
					source: 'static-file',
					rowCount: data.features.length,
					ms: Math.round(performance.now() - t0),
					rows
				});
				return;
			}

			// sql against S3 GeoParquet, with one retry after a heap reset
			let attempt = 0;
			for (;;) {
				try {
					const rows = await this.runSql(step.sql!);
					if (gen !== this.gen) return;
					this.patch(step.id, {
						status: 'done',
						source: 'duckdb-s3',
						rowCount: rows.length,
						ms: Math.round(performance.now() - t0),
						rows: rows.slice(0, KEPT_ROWS),
						points: pointsFrom(rows)
					});
					return;
				} catch (e) {
					const msg = (e as Error).message;
					if (attempt === 0 && msg.includes('memory access out of bounds')) {
						attempt++;
						const duck = await import('$lib/data/duckdb');
						duck.resetDuckDB();
						continue;
					}
					throw e;
				}
			}
		} catch (e) {
			if (gen !== this.gen) return;
			const canned = step.kind === 'sql' ? cannedFallback(step.sql) : null;
			if (canned) {
				this.patch(step.id, {
					status: 'fallback',
					source: 'canned',
					rowCount: canned.rows.length,
					ms: Math.round(performance.now() - t0),
					rows: canned.rows,
					points: pointsFrom(canned.rows),
					error: (e as Error).message
				});
			} else {
				this.patch(step.id, {
					status: 'error',
					ms: Math.round(performance.now() - t0),
					error: (e as Error).message
				});
			}
		}
	}

	private async runSql(sql: string): Promise<Record<string, unknown>[]> {
		const [duck, inventory] = await Promise.all([
			import('$lib/data/duckdb'),
			loadData<Inventory>('overture/inventory.json')
		]);
		const db = await duck.getDuckDB();
		this.partUrls ??= await listParquetParts(inventory.release, 'places', 'place');
		const pruned = this.bbox
			? pruneParts(this.partUrls, inventory.places_file_extents, this.bbox)
			: { kept: this.partUrls, dropped: 0 };
		const conn = await db.connect();
		try {
			const table = await conn.query(resolveSql(sql, pruned.kept));
			return table.toArray().map((r) => {
				const o = r.toJSON() as Record<string, unknown>;
				for (const k of Object.keys(o)) {
					if (typeof o[k] === 'bigint') o[k] = Number(o[k]);
				}
				return o;
			});
		} finally {
			await conn.close();
		}
	}

	private patch(id: string, changes: Partial<ResearchStep>): void {
		this.steps = this.steps.map((s) => (s.id === id ? { ...s, ...changes } : s));
	}

	private digests(): StepDigest[] {
		return this.steps.map((s) => {
			const pts = s.points?.features ?? [];
			const centroid: [number, number] | undefined = pts.length
				? [
						pts.reduce((a, f) => a + (f.geometry as GeoJSON.Point).coordinates[0], 0) / pts.length,
						pts.reduce((a, f) => a + (f.geometry as GeoJSON.Point).coordinates[1], 0) / pts.length
					]
				: undefined;
			const topRows = (s.rows ?? [])
				.slice(0, 3)
				.map((r) => `${r.name ?? r.basic_category ?? '?'}${r.n !== undefined ? ` (${r.n})` : ''}`)
				.join(', ');
			return {
				id: s.id,
				title: s.title,
				kind: s.kind,
				status: s.status,
				source: s.source,
				rowCount: s.rowCount,
				centroid,
				topRows: topRows || undefined
			};
		});
	}

	private stopTimer(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}
}

function pointsFrom(rows: Record<string, unknown>[]): GeoJSON.FeatureCollection | undefined {
	const pts = rows.filter((r) => typeof r.lon === 'number' && typeof r.lat === 'number');
	if (!pts.length) return undefined;
	return {
		type: 'FeatureCollection',
		features: pts.map((r) => ({
			type: 'Feature',
			properties: {
				name: String(r.name ?? ''),
				category: String(r.basic_category ?? ''),
				confidence: typeof r.confidence === 'number' ? r.confidence : undefined
			},
			geometry: { type: 'Point', coordinates: [r.lon as number, r.lat as number] }
		}))
	};
}

export const research = new ResearchAgent();
