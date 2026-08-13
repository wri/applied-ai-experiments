<script lang="ts">
	import { llm } from '$lib/llm/provider.svelte';
	import { StructuredOutputError } from '$lib/llm/structured';
	import { mapStore } from '$lib/map/MapStore.svelte';
	import GeoJSONSource from '$lib/map/GeoJSONSource.svelte';
	import HoverPopup from '$lib/map/HoverPopup.svelte';
	import MapLayer from '$lib/map/MapLayer.svelte';
	import { listParquetParts } from '$lib/data/overture';
	import { loadData } from '$lib/data/load';
	import OverlayPanel from '$lib/shell/OverlayPanel.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { Button } from '@wri-datalab/ui';
	import Panel from '$lib/ui/Panel.svelte';
	import Spinner from '$lib/ui/Spinner.svelte';
	import { Input as TextInput } from '@wri-datalab/ui';
	import OvertureScene from '../shared/OvertureScene.svelte';
	import { nlSqlMock, SUGGESTIONS } from './mocks';
	import {
		clampBbox,
		NL_SQL_SCHEMA,
		PLACES_SCHEMA_PROMPT,
		pruneParts,
		resolveSql,
		sqlGuardErrors,
		type Bbox,
		type FileExtent,
		type NlSql
	} from '$lib/data/overtureSql';

	interface Inventory {
		release: string;
		places_file_extents: FileExtent[];
	}

	let nl = $state('');
	let phase = $state<'idle' | 'generating' | 'engine' | 'querying'>('idle');
	let proposal = $state<NlSql | null>(null);
	let guardErrors = $state<string[]>([]);
	let error = $state<string | null>(null);
	let bboxClamped = $state(false);

	interface RunStats {
		release: string;
		filesTotal: number;
		filesScanned: number;
		ms: number;
		rows: number;
	}
	let rows = $state.raw<Record<string, unknown>[]>([]);
	let columns = $state<string[]>([]);
	let stats = $state<RunStats | null>(null);
	let partUrls = $state<string[]>([]);
	let lastBbox = $state<Bbox | null>(null);

	const resultsFc = $derived.by<GeoJSON.FeatureCollection | null>(() => {
		const pts = rows.filter((r) => typeof r.lon === 'number' && typeof r.lat === 'number');
		if (!pts.length) return null;
		return {
			type: 'FeatureCollection',
			features: pts.map((r) => ({
				type: 'Feature',
				properties: { name: String(r.name ?? '') },
				geometry: { type: 'Point', coordinates: [r.lon as number, r.lat as number] }
			}))
		};
	});

	function viewportBboxLine(): string {
		const b = mapStore.viewport.bounds;
		const raw = b
			? { w: b[0][0], s: b[0][1], e: b[1][0], n: b[1][1] }
			: { w: 105.68, s: 9.98, e: 105.88, n: 10.12 };
		const { bbox, clamped } = clampBbox(raw);
		bboxClamped = clamped;
		lastBbox = bbox;
		return `bbox.xmin BETWEEN ${bbox.w} AND ${bbox.e} AND bbox.ymin BETWEEN ${bbox.s} AND ${bbox.n}`;
	}

	async function generate(text?: string) {
		const q = (text ?? nl).trim();
		if (!q || phase !== 'idle') return;
		nl = q;
		phase = 'generating';
		error = null;
		proposal = null;
		guardErrors = [];
		try {
			const result = await llm.structured<NlSql>(
				{
					system:
						'You translate a natural-language question into ONE DuckDB SELECT over Overture Maps places.\n' +
						PLACES_SCHEMA_PROMPT,
					messages: [
						{
							role: 'user',
							content: `Question: ${q}\n\nCurrent viewport predicate (use it verbatim): ${viewportBboxLine()}`
						}
					],
					maxTokens: 600,
					mock: nlSqlMock()
				},
				NL_SQL_SCHEMA
			);
			proposal = result.value;
			guardErrors = sqlGuardErrors(result.value.sql);
		} catch (e) {
			error =
				e instanceof StructuredOutputError
					? `SQL generation rejected: ${e.validationErrors.join('; ')}`
					: (e as Error).message;
		} finally {
			phase = 'idle';
		}
	}

	async function run() {
		if (!proposal || guardErrors.length || phase !== 'idle') return;
		error = null;
		try {
			phase = 'engine';
			// The extract-time inventory carries the release id and per-file spatial
			// extents — both must come from the same listing for pruning to match.
			const [duck, inventory] = await Promise.all([
				import('$lib/data/duckdb'),
				loadData<Inventory>('overture/inventory.json')
			]);
			const db = await duck.getDuckDB();
			if (!partUrls.length) {
				partUrls = await listParquetParts(inventory.release, 'places', 'place');
			}
			const pruned = lastBbox
				? pruneParts(partUrls, inventory.places_file_extents, lastBbox)
				: { kept: partUrls, dropped: 0 };

			phase = 'querying';
			const t0 = performance.now();
			const conn = await db.connect();
			try {
				const table = await conn.query(resolveSql(proposal.sql, pruned.kept));
				const ms = performance.now() - t0;
				const raw = table.toArray().map((r) => {
					const o = r.toJSON() as Record<string, unknown>;
					for (const k of Object.keys(o)) {
						if (typeof o[k] === 'bigint') o[k] = Number(o[k]);
					}
					return o;
				});
				rows = raw;
				columns = raw.length ? Object.keys(raw[0]) : [];
				stats = {
					release: inventory.release,
					filesTotal: partUrls.length,
					filesScanned: pruned.kept.length,
					ms: Math.round(ms),
					rows: raw.length
				};
			} finally {
				await conn.close();
			}
		} catch (e) {
			const msg = (e as Error).message;
			if (msg.includes('memory access out of bounds')) {
				// an overflowed wasm heap stays poisoned — replace the worker
				const duck = await import('$lib/data/duckdb');
				duck.resetDuckDB();
				error =
					'The query overran the browser wasm heap; the engine has been reset — run again (file-level pruning should keep it in bounds).';
			} else {
				error = msg;
			}
		} finally {
			phase = 'idle';
		}
	}

	function fmt(v: unknown): string {
		if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3);
		return String(v ?? '');
	}
</script>

<OvertureScene show={{ places: false, flood: false }} />

<HoverPopup
	layers={[
		{
			layerId: 'duckdb-results-dots',
			title: (p) => String(p.name ?? 'Result'),
			hitPad: 5,
			fields: []
		}
	]}
/>

{#if resultsFc}
	<GeoJSONSource id="duckdb-results" data={resultsFc}>
		<MapLayer
			spec={{
				id: 'duckdb-results-dots',
				type: 'circle',
				source: 'duckdb-results',
				paint: {
					'circle-color': '#eab308',
					'circle-radius': 4,
					'circle-opacity': 0.85,
					'circle-stroke-width': 1,
					'circle-stroke-color': '#1c1a18'
				}
			}}
		/>
	</GeoJSONSource>
{/if}

<OverlayPanel side="right" width="27rem" fill>
	<Panel title="Cloud-native query">
		{#snippet actions()}
			<Badge tone={llm.mode === 'mock' ? 'neutral' : 'primary'}>{llm.mode}</Badge>
		{/snippet}
		<p class="lead">
			The question becomes <strong>constrained SQL</strong> (one SELECT, viewport predicate,
			LIMIT — validated in code), and DuckDB-WASM executes it <strong>in this tab</strong>
			against Overture's 10 GB places GeoParquet on S3. No server: HTTP range requests read only
			the parquet footers and the row groups your bbox touches. The query runs for real even in
			mock mode — only the SQL generation is mocked.
		</p>
		<form
			onsubmit={(e) => {
				e.preventDefault();
				generate();
			}}
		>
			<TextInput bind:value={nl} placeholder="Restaurants and cafés in view…" />
			<div class="row">
				<Button variant="primary" type="submit" disabled={phase !== 'idle' || !nl.trim()}>
					{#if phase === 'generating'}<Spinner size={12} />{/if}
					generate sql
				</Button>
				{#if proposal && !guardErrors.length}
					<Button onclick={run} disabled={phase !== 'idle'}>
						{#if phase === 'engine' || phase === 'querying'}<Spinner size={12} />{/if}
						{phase === 'engine' ? 'loading engine…' : phase === 'querying' ? 'querying s3…' : 'run on overture s3'}
					</Button>
				{/if}
			</div>
		</form>
		<div class="chips">
			{#each SUGGESTIONS as s (s)}
				<button class="chip" onclick={() => generate(s)} disabled={phase !== 'idle'}>{s}</button>
			{/each}
		</div>
		{#if bboxClamped}
			<p class="note">viewport wider than 0.5° — the predicate was clamped around the center</p>
		{/if}
		{#if error}<p class="error">{error}</p>{/if}
	</Panel>

	{#if proposal}
		<Panel title="Proposed SQL">
			{#snippet actions()}
				{#if guardErrors.length}
					<Badge tone="error">blocked</Badge>
				{:else}
					<Badge tone="success">passed guards</Badge>
				{/if}
			{/snippet}
			<p class="summary">{proposal.summary}</p>
			<pre class="sql">{proposal.sql}</pre>
			{#if guardErrors.length}
				<ul class="errs">
					{#each guardErrors as g (g)}<li>{g}</li>{/each}
				</ul>
			{:else}
				<p class="note">
					guards passed: single SELECT · no DDL · viewport predicate present · LIMIT enforced.
					<code>__PLACES__</code> resolves to <code>read_parquet([16 S3 part files])</code> at run
					time.
				</p>
			{/if}
		</Panel>
	{/if}

	{#if stats}
		<Panel title="What actually happened">
			<div class="stats">
				<div><span class="k">release</span><span class="v">{stats.release}</span></div>
				<div>
					<span class="k">file-level pruning</span>
					<span class="v">{stats.filesTotal} files → {stats.filesScanned} scanned</span>
				</div>
				<div><span class="k">wall clock</span><span class="v">{stats.ms} ms</span></div>
				<div><span class="k">rows</span><span class="v">{stats.rows}</span></div>
			</div>
			<p class="note">
				Two pruning levels made this practical: (1) per-file spatial extents, indexed once at
				extract time, drop whole part files before DuckDB runs; (2) inside the survivors, DuckDB
				reads the footer and skips every row group whose bbox stats cannot intersect the
				predicate — range-requesting megabytes out of ~10 GB. (Bytes are fetched by the wasm
				worker, invisible to this page's resource timing — honest limit of the measurement.)
			</p>
			{#if partUrls.length}
				<details>
					<summary>the {partUrls.length} part files</summary>
					<ul class="files">
						{#each partUrls as u (u)}<li>{u.split('/').pop()}</li>{/each}
					</ul>
				</details>
			{/if}
		</Panel>
	{/if}

	{#if rows.length}
		<Panel title="Results ({rows.length} rows{resultsFc ? ', plotted' : ''})" padded={false}>
			<div class="tbl-wrap">
				<table>
					<thead>
						<tr>{#each columns as c (c)}<th>{c}</th>{/each}</tr>
					</thead>
					<tbody>
						{#each rows.slice(0, 12) as r, i (i)}
							<tr>{#each columns as c (c)}<td>{fmt(r[c])}</td>{/each}</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if rows.length > 12}
				<div class="more">…and {rows.length - 12} more rows{resultsFc ? ' (all plotted on the map)' : ''}</div>
			{/if}
		</Panel>
	{/if}
</OverlayPanel>

<style>
	.lead {
		margin: 0 0 var(--space-3);
		font-size: 0.78rem;
		line-height: 1.55;
		color: var(--tx-2);
	}
	.lead strong {
		color: var(--tx);
	}
	.row {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: var(--space-3);
	}
	.chip {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--tx-2);
		background: var(--bg);
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		padding: 0.3rem 0.5rem;
		cursor: pointer;
	}
	.chip:hover:not(:disabled) {
		border-color: var(--primary);
		color: var(--tx);
	}
	.summary {
		margin: 0 0 var(--space-2);
		font-size: 0.75rem;
		color: var(--tx);
	}
	.sql {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		line-height: 1.5;
		color: var(--tx-2);
		background: var(--bg);
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		padding: var(--space-2);
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.errs {
		margin: var(--space-2) 0 0;
		padding-left: 1rem;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--error-text);
	}
	.note {
		margin: var(--space-2) 0 0;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		line-height: 1.5;
		color: var(--tx-3);
	}
	.note code {
		color: var(--tx-2);
	}
	.error {
		margin: var(--space-2) 0 0;
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		color: var(--error-text);
	}
	.stats {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.stats > div {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
		font-family: var(--font-mono);
		font-size: 0.68rem;
	}
	.stats .k {
		color: var(--tx-3);
	}
	.stats .v {
		color: var(--tx);
		text-align: right;
	}
	details {
		margin-top: var(--space-2);
	}
	summary {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-3);
		cursor: pointer;
	}
	.files {
		margin: var(--space-2) 0 0;
		padding-left: 1rem;
		font-family: var(--font-mono);
		font-size: 0.58rem;
		color: var(--tx-3);
		max-height: 8rem;
		overflow-y: auto;
	}
	.tbl-wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-mono);
		font-size: 0.62rem;
	}
	th,
	td {
		text-align: left;
		padding: 0.3rem var(--space-2);
		border-bottom: 1px solid var(--ui);
		white-space: nowrap;
		max-width: 12rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	th {
		color: var(--tx-3);
		font-weight: 500;
		position: sticky;
		top: 0;
		background: var(--bg-2);
	}
	td {
		color: var(--tx);
	}
	.more {
		padding: 0.4rem var(--space-3);
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-3);
	}
</style>
