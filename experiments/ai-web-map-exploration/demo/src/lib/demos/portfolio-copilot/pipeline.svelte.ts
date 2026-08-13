/**
 * Reactive pipeline store: idle → repairing → review → screened, plus the
 * grounded Q&A run. Deterministic steps (parse, duplicates, screening, stats)
 * are code; the LLM only repairs flagged rows and answers over computed stats.
 */

import { llm } from '$lib/llm/provider.svelte';
import { LlmRun } from '$lib/llm/run.svelte';
import { StructuredOutputError } from '$lib/llm/structured';
import {
	guessColumns,
	parseCsv,
	prePass,
	type ColumnGuess,
	type CsvRow,
	type CsvTable,
	type PrePassResult
} from './csv';
import { qaMock, repairMock } from './mocks';
import {
	buildQaSystem,
	buildRepairPrompt,
	buildRepairSchema,
	REPAIR_SYSTEM,
	type PortfolioStats,
	type RepairResult,
	type RowRepair
} from './schema';
import { computeStats, indexBasins, screenSites, type ScreenedSite, type Site } from './screen';

export type Stage = 'idle' | 'repairing' | 'review' | 'screened';

const MAX_BYTES = 1_000_000;
const MAX_ROWS = 300;
const REGION = { lonMin: 100, lonMax: 112, latMin: 6, latMax: 24 };

export class Pipeline {
	stage = $state<Stage>('idle');
	/** terminal intake error (bad file, no coordinate columns) */
	error = $state<string | null>(null);
	/** repair-call error (retryable; offers the skip-AI escape hatch) */
	repairError = $state<string | null>(null);
	fileName = $state('');

	table = $state.raw<CsvTable | null>(null);
	mapping = $state.raw<ColumnGuess | null>(null);
	pre = $state.raw<PrePassResult | null>(null);
	repair = $state.raw<RepairResult | null>(null);
	/** rowId → reason, for AI repairs demoted by the code sanity check */
	demoted = $state.raw<Record<number, string>>({});
	/** rowId → accepted?, for repaired rows (default true) */
	accepted = $state<Record<number, boolean>>({});

	screened = $state.raw<ScreenedSite[] | null>(null);
	stats = $state.raw<PortfolioStats | null>(null);

	qa = new LlmRun();
	qaHistory = $state<{ q: string; a: string }[]>([]);
	pendingQ = $state<string | null>(null);

	private ctrl: AbortController | null = null;

	reset() {
		this.ctrl?.abort();
		this.ctrl = null;
		this.qa.abort();
		this.stage = 'idle';
		this.error = null;
		this.repairError = null;
		this.fileName = '';
		this.table = null;
		this.mapping = null;
		this.pre = null;
		this.repair = null;
		this.demoted = {};
		this.accepted = {};
		this.screened = null;
		this.stats = null;
		this.qaHistory = [];
		this.pendingQ = null;
	}

	async load(text: string, fileName: string): Promise<void> {
		this.reset();
		this.fileName = fileName;
		if (text.length > MAX_BYTES) {
			this.error = 'File is over 1 MB — this probe caps at 300 rows.';
			return;
		}
		const table = parseCsv(text);
		if (!table.headers.length || !table.rows.length) {
			this.error = 'Could not parse any data rows from this file.';
			return;
		}
		if (table.rows.length > MAX_ROWS) {
			this.error = `${table.rows.length} rows — this probe caps at ${MAX_ROWS}.`;
			return;
		}
		this.table = table;
		const mapping = guessColumns(table);
		this.mapping = mapping;
		if (!mapping.lat || !mapping.lon) {
			this.error = `Could not identify coordinate columns. Headers found: ${table.headers.join(', ')}.`;
			return;
		}
		this.pre = prePass(table, mapping);
		await this.runRepair();
	}

	async runRepair(): Promise<void> {
		if (!this.table || !this.pre || !this.mapping) return;
		this.repairError = null;

		if (this.pre.flagged.length === 0) {
			this.repair = { mapping: this.mapping, rows: [] };
			this.stage = 'review';
			return;
		}

		this.stage = 'repairing';
		this.ctrl = new AbortController();
		try {
			const result = await llm.structured<RepairResult>(
				{
					system: REPAIR_SYSTEM,
					maxTokens: 3000,
					messages: [
						{
							role: 'user',
							content: buildRepairPrompt(
								this.table.headers,
								this.pre.clean.slice(0, 3),
								this.pre.flagged
							)
						}
					],
					mock: repairMock()
				},
				buildRepairSchema(
					this.table.headers,
					this.pre.flagged.map((r) => r.id)
				),
				{ signal: this.ctrl.signal }
			);
			this.applySanityChecks(result.value);
			this.stage = 'review';
		} catch (e) {
			this.repairError =
				e instanceof StructuredOutputError
					? `Repair output rejected: ${e.validationErrors.join('; ')}`
					: (e as Error).message;
			this.stage = 'review'; // review panel shows the error + escape hatches
		}
	}

	/** trust boundary: code demotes AI repairs that fail sanity checks */
	private applySanityChecks(result: RepairResult) {
		const demoted: Record<number, string> = {};
		const flaggedIds = new Set(this.pre!.flagged.map((r) => r.id));
		const seen = new Set<number>();
		const rows: RowRepair[] = [];

		for (const r of result.rows) {
			if (!flaggedIds.has(r.rowId) || seen.has(r.rowId)) continue;
			seen.add(r.rowId);
			if (r.disposition === 'repaired') {
				const bad =
					r.repairedLat === undefined ||
					r.repairedLon === undefined ||
					r.repairedLat < REGION.latMin - 20 ||
					r.repairedLat > REGION.latMax + 20 ||
					r.repairedLon < REGION.lonMin - 20 ||
					r.repairedLon > REGION.lonMax + 20;
				if (bad) {
					demoted[r.rowId] = 'AI repair failed the code sanity check (missing or far-out coordinates)';
					rows.push({
						rowId: r.rowId,
						disposition: 'needs-review',
						reviewReason: demoted[r.rowId]
					});
					continue;
				}
			}
			rows.push(r);
		}
		// rows the model never mentioned default to needs-review
		for (const f of this.pre!.flagged) {
			if (!seen.has(f.id)) {
				demoted[f.id] = 'model returned no disposition for this row';
				rows.push({ rowId: f.id, disposition: 'needs-review', reviewReason: demoted[f.id] });
			}
		}
		this.demoted = demoted;
		this.repair = { ...result, rows };
		const accepted: Record<number, boolean> = {};
		for (const r of rows) if (r.disposition === 'repaired') accepted[r.rowId] = true;
		this.accepted = accepted;
	}

	/** escape hatch after a failed repair call: screen clean rows only */
	skipRepair() {
		if (!this.mapping || !this.pre) return;
		this.repair = {
			mapping: this.mapping,
			rows: this.pre.flagged.map((r) => ({
				rowId: r.id,
				disposition: 'needs-review',
				reviewReason: 'AI repair skipped — flagged rows excluded'
			}))
		};
		this.repairError = null;
		this.stage = 'review';
	}

	get repairSummary() {
		const rows = this.repair?.rows ?? [];
		return {
			ok: rows.filter((r) => r.disposition === 'ok').length + (this.pre?.clean.length ?? 0),
			repaired: rows.filter((r) => r.disposition === 'repaired').length,
			needsReview: rows.filter((r) => r.disposition === 'needs-review').length,
			duplicates: this.pre?.duplicates.length ?? 0
		};
	}

	/** rows that will screen, given current accept/reject state */
	usableSites(): Site[] {
		if (!this.table || !this.pre || !this.repair) return [];
		const headers = this.table.headers;
		const m = this.repair.mapping;
		const idx = (h: string | null) => (h ? headers.indexOf(h) : -1);
		const latIdx = idx(m.lat);
		const lonIdx = idx(m.lon);
		const nameIdx = idx(m.name);
		const countryIdx = idx(m.country);
		const sectorIdx = idx(m.sector);

		const fromCells = (row: CsvRow, repaired: boolean, r?: RowRepair): Site | null => {
			const lat = r?.repairedLat ?? Number(row.cells[latIdx]);
			const lon = r?.repairedLon ?? Number(row.cells[lonIdx]);
			if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
			return {
				rowId: row.id,
				name:
					r?.repairedName ??
					(nameIdx >= 0 ? row.cells[nameIdx] : '') ??
					`row ${row.id}`,
				lat,
				lon,
				country: countryIdx >= 0 ? row.cells[countryIdx] : undefined,
				sector: sectorIdx >= 0 ? row.cells[sectorIdx] : undefined,
				repaired
			};
		};

		const byId = new Map(this.pre.flagged.map((r) => [r.id, r]));
		const sites: Site[] = [];
		for (const row of this.pre.clean) {
			const s = fromCells(row, false);
			if (s) sites.push(s);
		}
		for (const r of this.repair.rows) {
			const row = byId.get(r.rowId);
			if (!row) continue;
			if (r.disposition === 'ok') {
				const s = fromCells(row, false);
				if (s) sites.push(s);
			} else if (r.disposition === 'repaired' && (this.accepted[r.rowId] ?? true)) {
				const s = fromCells(row, true, r);
				if (s) sites.push(s);
			}
		}
		return sites;
	}

	screen(basinsFc: GeoJSON.FeatureCollection) {
		if (!this.table || !this.repair) return;
		const basins = indexBasins(basinsFc);
		const sites = this.usableSites();
		const screened = screenSites(sites, basins);
		const rejectedRepairs = (this.repair.rows ?? []).filter(
			(r) => r.disposition === 'repaired' && !(this.accepted[r.rowId] ?? true)
		).length;
		this.screened = screened;
		this.stats = computeStats(
			screened,
			{
				needsReview: this.repairSummary.needsReview,
				rejectedRepairs,
				duplicates: this.repairSummary.duplicates
			},
			basins,
			this.table.rows.length
		);
		this.stage = 'screened';
	}

	async ask(q: string): Promise<void> {
		if (!this.stats || this.qa.isStreaming) return;
		this.pendingQ = q;
		const messages = [
			...this.qaHistory.flatMap((t) => [
				{ role: 'user' as const, content: t.q },
				{ role: 'assistant' as const, content: t.a }
			]),
			{ role: 'user' as const, content: q }
		];
		await this.qa.run({
			system: buildQaSystem(this.stats),
			maxTokens: 600,
			messages,
			mock: qaMock()
		});
		if (this.qa.content && !this.qa.error) {
			this.qaHistory = [...this.qaHistory, { q, a: this.qa.content }];
		}
		this.pendingQ = null;
	}
}
