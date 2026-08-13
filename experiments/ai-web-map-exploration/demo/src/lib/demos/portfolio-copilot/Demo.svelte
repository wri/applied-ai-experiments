<script lang="ts">
	import { loadData, loadText } from '$lib/data/load';
	import { llm } from '$lib/llm/provider.svelte';
	import GeoJSONSource from '$lib/map/GeoJSONSource.svelte';
	import HoverPopup from '$lib/map/HoverPopup.svelte';
	import MapLayer from '$lib/map/MapLayer.svelte';
	import { mapStore } from '$lib/map/MapStore.svelte';
	import OverlayPanel from '$lib/shell/OverlayPanel.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { Button } from '@wri-datalab/ui';
	import Panel from '$lib/ui/Panel.svelte';
	import Spinner from '$lib/ui/Spinner.svelte';
	import { StreamingMarkdown as StreamedText } from '@wri-datalab/ui';
	import { Input as TextInput } from '@wri-datalab/ui';
	import { toasts } from '$lib/ui/toast.svelte';
	import Legend from '../shared/Legend.svelte';
	import {
		classLabel,
		NO_DATA_COLOR,
		polygonBounds,
		RISK_CLASSES,
		riskClassIndex,
		type IndicatorCode
	} from '../shared/waterRisk';
	import { indexBasins } from './screen';
	import { Pipeline } from './pipeline.svelte';
	import type { FilterSpecification } from 'maplibre-gl';

	const pipeline = new Pipeline();

	let basinsFc = $state.raw<GeoJSON.FeatureCollection | null>(null);
	$effect(() => {
		loadData('water-risk/basins.geojson').then((d) => (basinsFc = d));
	});

	// choropleth props (overall under demo-default weights) injected in code
	const scoredFc = $derived.by<GeoJSON.FeatureCollection | null>(() => {
		if (!basinsFc) return null;
		const indexed = indexBasins(basinsFc);
		return {
			type: 'FeatureCollection',
			features: basinsFc.features.map((f, i) => ({
				...f,
				properties: { ...f.properties, overall: Number(indexed[i].overall.toFixed(2)) }
			}))
		};
	});

	let selectedBasinId = $state<string | null>(null);
	let reportCollapsed = $state(false);
	let question = $state('');

	const SUGGESTIONS = [
		'Which basins drive my risk?',
		'Summarize for my board',
		'Where are my flood-exposed sites?',
		'Why were some sites not screened?'
	];

	// --- drag & drop ---
	let dragging = $state(false);
	$effect(() => {
		let depth = 0;
		const onDragOver = (e: DragEvent) => {
			if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
		};
		const onDragEnter = (e: DragEvent) => {
			if (e.dataTransfer?.types.includes('Files')) {
				depth++;
				dragging = true;
			}
		};
		const onDragLeave = () => {
			depth = Math.max(0, depth - 1);
			if (depth === 0) dragging = false;
		};
		const onDrop = async (e: DragEvent) => {
			depth = 0;
			dragging = false;
			if (!e.dataTransfer?.files.length) return;
			e.preventDefault();
			const file = e.dataTransfer.files[0];
			if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
				toasts.push({ tone: 'error', title: 'Not a CSV', body: `${file.name} — drop a .csv site list` });
				return;
			}
			await pipeline.load(await file.text(), file.name);
		};
		window.addEventListener('dragover', onDragOver);
		window.addEventListener('dragenter', onDragEnter);
		window.addEventListener('dragleave', onDragLeave);
		window.addEventListener('drop', onDrop);
		return () => {
			window.removeEventListener('dragover', onDragOver);
			window.removeEventListener('dragenter', onDragEnter);
			window.removeEventListener('dragleave', onDragLeave);
			window.removeEventListener('drop', onDrop);
		};
	});

	async function loadSample() {
		const text = await loadText('water-risk/portfolio-sites.csv');
		await pipeline.load(text, 'portfolio-sites.csv (sample)');
	}

	function screenNow() {
		if (basinsFc) {
			pipeline.screen(basinsFc);
			reportCollapsed = true;
		}
	}

	// --- map derived ---
	const OVERALL_EXPR = [
		'step',
		['get', 'overall'],
		RISK_CLASSES[0].color,
		1,
		RISK_CLASSES[1].color,
		2,
		RISK_CLASSES[2].color,
		3,
		RISK_CLASSES[3].color,
		4,
		RISK_CLASSES[4].color
	];
	const touchedBasinIds = $derived(
		pipeline.stats ? pipeline.stats.topBasins.map((b) => b.basinId) : []
	);
	const siteBasinIds = $derived.by(() => {
		const ids = new Set<string>();
		for (const s of pipeline.screened ?? []) if (s.basinId) ids.add(s.basinId);
		return [...ids];
	});
	const basinOpacity = $derived(
		pipeline.stage === 'screened' && siteBasinIds.length
			? ['case', ['in', ['get', 'id'], ['literal', siteBasinIds]], 0.75, 0.18]
			: 0.45
	);
	const selectedFilter = $derived.by<FilterSpecification>(() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return ['==', ['get', 'id'], selectedBasinId ?? '__none__'] as any;
	});

	const sitesFc = $derived.by<GeoJSON.FeatureCollection>(() => {
		return {
			type: 'FeatureCollection',
			features: (pipeline.screened ?? []).map((s) => ({
				type: 'Feature',
				properties: {
					name: s.name,
					sector: s.sector ?? '',
					basin: s.basinName ?? 'no coverage',
					covered: s.basinId ? 1 : 0,
					classIndex: s.classIndex ?? -1,
					classLabel: s.classIndex === null ? 'no coverage' : classLabel(s.classIndex),
					repaired: s.repaired ? 'AI-repaired (accepted)' : 'as uploaded'
				},
				geometry: { type: 'Point', coordinates: [s.lon, s.lat] }
			}))
		};
	});
	const SITE_COLOR = [
		'match',
		['get', 'classIndex'],
		0,
		RISK_CLASSES[0].color,
		1,
		RISK_CLASSES[1].color,
		2,
		RISK_CLASSES[2].color,
		3,
		RISK_CLASSES[3].color,
		4,
		RISK_CLASSES[4].color,
		'transparent'
	];

	function flyToBasin(id: string) {
		selectedBasinId = id;
		const f = basinsFc?.features.find((x) => x.properties?.id === id);
		if (f) mapStore.fitBounds(polygonBounds(f), 120);
	}

	// --- Q&A citation segmentation (grounding guard: unknown ids render inert) ---
	const MARKER = /\[\[basin:([^\]]+)\]\]/g;
	function segments(text: string): { kind: 'text' | 'chip' | 'dead'; value: string; name?: string }[] {
		const known = new Map((pipeline.stats?.topBasins ?? []).map((b) => [b.basinId, b.name]));
		const out: { kind: 'text' | 'chip' | 'dead'; value: string; name?: string }[] = [];
		let last = 0;
		for (const m of text.matchAll(MARKER)) {
			if (m.index! > last) out.push({ kind: 'text', value: text.slice(last, m.index) });
			const id = m[1];
			if (known.has(id)) out.push({ kind: 'chip', value: id, name: known.get(id) });
			else out.push({ kind: 'dead', value: id });
			last = m.index! + m[0].length;
		}
		if (last < text.length) out.push({ kind: 'text', value: text.slice(last) });
		return out;
	}

	const TILE_DEFS = $derived(
		pipeline.stats
			? [
					{ label: 'screened', value: pipeline.stats.screenedSites },
					{
						label: 'high + extreme',
						value:
							(pipeline.stats.sitesByClass['High'] ?? 0) +
							(pipeline.stats.sitesByClass['Extremely high'] ?? 0)
					},
					{ label: 'basins touched', value: siteBasinIds.length },
					{ label: 'no coverage', value: pipeline.stats.noCoverageSites, warn: true }
				]
			: []
	);
</script>

{#if scoredFc}
	<GeoJSONSource id="basins" data={scoredFc} promoteId="id">
		<MapLayer
			spec={{
				id: 'basins-fill',
				type: 'fill',
				source: 'basins',
				paint: { 'fill-color': '#888888', 'fill-opacity': 0.45 }
			}}
			paint={{ 'fill-color': OVERALL_EXPR, 'fill-opacity': basinOpacity }}
		/>
		<MapLayer
			spec={{
				id: 'basins-outline',
				type: 'line',
				source: 'basins',
				paint: { 'line-color': '#6b6459', 'line-width': 0.6, 'line-opacity': 0.5 }
			}}
		/>
		<MapLayer
			spec={{
				id: 'basins-selected',
				type: 'line',
				source: 'basins',
				paint: { 'line-color': '#2563eb', 'line-width': 2.5 }
			}}
			filter={selectedFilter}
		/>
	</GeoJSONSource>
{/if}

{#if pipeline.screened}
	<GeoJSONSource id="pc-sites" data={sitesFc}>
		<MapLayer
			spec={{
				id: 'pc-sites-covered',
				type: 'circle',
				source: 'pc-sites',
				filter: ['==', ['get', 'covered'], 1],
				paint: {
					'circle-color': '#888888',
					'circle-radius': 5,
					'circle-stroke-width': 1.2,
					'circle-stroke-color': '#1c1a18'
				}
			}}
			paint={{ 'circle-color': SITE_COLOR }}
		/>
		<MapLayer
			spec={{
				id: 'pc-sites-uncovered',
				type: 'circle',
				source: 'pc-sites',
				filter: ['==', ['get', 'covered'], 0],
				paint: {
					'circle-color': 'transparent',
					'circle-radius': 5,
					'circle-stroke-width': 2,
					'circle-stroke-color': NO_DATA_COLOR
				}
			}}
		/>
	</GeoJSONSource>
	<HoverPopup
		layers={[
			{
				layerId: 'pc-sites-covered',
				title: (p) => String(p.name),
				hitPad: 5,
				fields: [
					{ prop: 'sector', label: 'sector' },
					{ prop: 'basin', label: 'basin' },
					{ prop: 'classLabel', label: 'basin risk' },
					{ prop: 'repaired', label: 'row' }
				]
			},
			{
				layerId: 'pc-sites-uncovered',
				title: (p) => String(p.name),
				hitPad: 5,
				fields: [
					{ prop: 'sector', label: 'sector' },
					{ prop: 'basin', label: 'basin' },
					{ prop: 'repaired', label: 'row' }
				]
			}
		]}
	/>
{/if}

<Legend
	title="basin water risk (portfolio)"
	entries={[
		...RISK_CLASSES.map((c) => ({ color: c.color, label: c.label })),
		{ color: NO_DATA_COLOR, label: 'site without basin coverage' }
	]}
	note="Basin scores REAL (public v4 dataset, 2023); demo-default weights. Sample portfolio is fictional."
/>

{#if dragging}
	<div class="drop-scrim">
		<div class="drop-msg">Drop a site CSV to screen your portfolio</div>
	</div>
{/if}

{#if pipeline.stage === 'repairing' || (pipeline.stage !== 'idle' && pipeline.repair && !reportCollapsed)}
	<OverlayPanel side="left" width="26rem">
		<Panel title="Repair report" padded={false}>
			{#snippet actions()}
				{#if pipeline.stage === 'screened'}
					<Button size="sm" variant="ghost" onclick={() => (reportCollapsed = true)}>collapse</Button>
				{/if}
			{/snippet}
			{#if pipeline.stage === 'repairing'}
				<div class="repairing"><Spinner size={14} /> AI repairing {pipeline.pre?.flagged.length} flagged rows…</div>
			{:else if pipeline.repair}
				{@const s = pipeline.repairSummary}
				<div class="summary">
					{s.ok} ok · {s.repaired} repaired · {s.needsReview} need review · {s.duplicates} duplicates removed
					<em>(code)</em>
				</div>
				{#if pipeline.repairError}
					<div class="repair-error">
						<p class="error">{pipeline.repairError}</p>
						<div class="row-actions">
							<Button size="sm" onclick={() => pipeline.runRepair()}>retry</Button>
							<Button size="sm" variant="ghost" onclick={() => pipeline.skipRepair()}>
								screen clean rows only
							</Button>
						</div>
					</div>
				{/if}
				{#each pipeline.pre?.duplicates ?? [] as d (d.id)}
					<div class="row-card dup">
						<span class="row-id">#{d.id}</span>
						<span class="dup-note">exact duplicate of #{d.ofId} — removed by <b>code</b>, not AI</span>
					</div>
				{/each}
				{#each pipeline.repair.rows as r (r.rowId)}
					{@const original = pipeline.pre?.flagged.find((f) => f.id === r.rowId)}
					<div class="row-card">
						<div class="row-head">
							<span class="row-id">#{r.rowId}</span>
							<span class="cells">{original?.cells.join(' · ')}</span>
							<Badge
								tone={r.disposition === 'repaired'
									? 'success'
									: r.disposition === 'ok'
										? 'neutral'
										: 'warning'}
							>
								{r.disposition}
							</Badge>
						</div>
						{#if r.disposition === 'repaired'}
							{#each r.changes ?? [] as c, i (i)}
								<div class="change">
									<span class="field">{c.field}</span>
									<span class="from">{c.from}</span>
									<span class="arrow">→</span>
									<span class="to">{c.to}</span>
									<span class="reason">{c.reason}</span>
								</div>
							{/each}
							<label class="accept">
								<input
									type="checkbox"
									checked={pipeline.accepted[r.rowId] ?? true}
									onchange={() =>
										(pipeline.accepted = {
											...pipeline.accepted,
											[r.rowId]: !(pipeline.accepted[r.rowId] ?? true)
										})}
								/>
								accept this repair
							</label>
						{:else if r.disposition === 'needs-review'}
							<div class="review-reason">{r.reviewReason} — excluded from screening</div>
						{/if}
					</div>
				{/each}
				{#if pipeline.stage === 'review'}
					<div class="screen-row">
						<Button
							variant="primary"
							onclick={screenNow}
							disabled={!basinsFc || pipeline.usableSites().length === 0}
						>
							Screen {pipeline.usableSites().length} sites →
						</Button>
						{#if pipeline.usableSites().length === 0}
							<p class="error">no usable rows survived — nothing to screen</p>
						{/if}
					</div>
				{/if}
			{/if}
		</Panel>
	</OverlayPanel>
{/if}

<OverlayPanel side="right" width="26rem">
	<Panel title="Portfolio copilot">
		{#snippet actions()}
			<Badge tone={llm.mode === 'mock' ? 'neutral' : 'primary'}>{llm.mode}</Badge>
		{/snippet}
		<p class="lead">
			Drop a site CSV anywhere on the map — even a broken one. The AI repairs defective rows and
			shows its work for per-row approval; deterministic code assigns basins and computes the
			stats; answers cite basins you can fly to.
		</p>
		{#if pipeline.stage === 'idle'}
			<div class="intake-row">
				<Button variant="primary" onclick={loadSample} disabled={!basinsFc}>
					load sample portfolio
				</Button>
				<span class="hint">or drag a .csv onto the map</span>
			</div>
			{#if pipeline.error}<p class="error">{pipeline.error}</p>{/if}
		{:else}
			<div class="file-row">
				<span class="file">{pipeline.fileName}</span>
				<span class="stage-badge">{pipeline.stage}</span>
				<Button size="sm" variant="ghost" onclick={() => pipeline.reset()}>start over</Button>
			</div>
			{#if pipeline.error}<p class="error">{pipeline.error}</p>{/if}
			{#if reportCollapsed && pipeline.repair}
				<button class="reopen" onclick={() => (reportCollapsed = false)}>
					review repairs ({pipeline.repairSummary.repaired + pipeline.repairSummary.needsReview})
				</button>
			{/if}
		{/if}
	</Panel>

	{#if pipeline.stats}
		<Panel title="Portfolio risk">
			<div class="tiles">
				{#each TILE_DEFS as t (t.label)}
					<div class="tile" class:warn={t.warn && Number(t.value) > 0}>
						<div class="tile-value">{t.value}</div>
						<div class="tile-label">{t.label}</div>
					</div>
				{/each}
			</div>
			<div class="rank-head">highest-risk basins (site count × severity)</div>
			{#each pipeline.stats.topBasins as b, i (b.basinId)}
				<button
					class="rank-row"
					class:active={selectedBasinId === b.basinId}
					onclick={() => flyToBasin(b.basinId)}
				>
					<span class="rank">{i + 1}</span>
					<span class="rank-body">
						<span class="rank-name">
							{b.name}
							<i class="class-dot" style:background={RISK_CLASSES[riskClassIndex(b.overall)].color}
							></i>
							{b.classLabel} · {b.overall}
						</span>
						<span class="rank-meta">
							{b.siteCount} site{b.siteCount === 1 ? '' : 's'} · worst: {b.worstIndicators
								.map((w) => `${w.code} ${w.score.toFixed(1)}`)
								.join(', ')}
						</span>
					</span>
				</button>
			{/each}
			{#if pipeline.stats.notes.length}
				<div class="notes">
					{#each pipeline.stats.notes as n, i (i)}<p>{n}</p>{/each}
				</div>
			{/if}
		</Panel>

		<Panel title="Ask about your portfolio">
			<div class="chips">
				{#each SUGGESTIONS as s (s)}
					<button class="chip" disabled={pipeline.qa.isStreaming} onclick={() => pipeline.ask(s)}>
						{s}
					</button>
				{/each}
			</div>
			<form
				class="ask-row"
				onsubmit={(e) => {
					e.preventDefault();
					if (question.trim()) {
						pipeline.ask(question.trim());
						question = '';
					}
				}}
			>
				<TextInput bind:value={question} placeholder="ask about the screened portfolio…" />
				<Button type="submit" size="sm" variant="primary" disabled={pipeline.qa.isStreaming}>ask</Button>
			</form>
			{#each pipeline.qaHistory as turn, i (i)}
				<div class="turn">
					<div class="q">{turn.q}</div>
					<div class="a">
						{#each segments(turn.a) as seg, k (k)}
							{#if seg.kind === 'chip'}
								<button class="cite" onclick={() => flyToBasin(seg.value)}>{seg.name}</button>
							{:else if seg.kind === 'dead'}
								<span class="dead-cite" title="citation not in the computed stats — inert">
									[{seg.value}]
								</span>
							{:else}
								<StreamedText content={seg.value} />
							{/if}
						{/each}
					</div>
				</div>
			{/each}
			{#if pipeline.qa.isStreaming || pipeline.qa.error}
				<div class="turn">
					{#if pipeline.pendingQ}<div class="q">{pipeline.pendingQ}</div>{/if}
					{#if pipeline.qa.error}
						<p class="error">{pipeline.qa.error}</p>
					{:else}
						<div class="a"><StreamedText content={pipeline.qa.content.replace(MARKER, '')} streaming /></div>
					{/if}
				</div>
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
	.drop-scrim {
		position: absolute;
		inset: 0;
		z-index: 40;
		background: color-mix(in srgb, var(--bg) 55%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		border: 3px dashed var(--primary);
	}
	.drop-msg {
		background: var(--bg-2);
		border: 1px solid var(--ui);
		border-radius: var(--radius-md);
		padding: var(--space-3) var(--space-5);
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--tx);
	}
	.intake-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.hint {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-3);
	}
	.file-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.file {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--tx);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.stage-badge {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--primary);
		border: 1px solid var(--primary);
		border-radius: var(--radius-sm);
		padding: 0.05rem 0.3rem;
		flex: none;
	}
	.reopen {
		margin-top: var(--space-2);
		background: none;
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-2);
		padding: 0.25rem 0.5rem;
		cursor: pointer;
	}
	.reopen:hover {
		border-color: var(--primary);
		color: var(--primary);
	}
	.error {
		margin: var(--space-2) 0 0;
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		color: var(--error-text);
	}
	/* repair report */
	.repairing {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--tx-2);
	}
	.summary {
		padding: var(--space-2) var(--space-3);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--tx);
		border-bottom: 1px solid var(--ui);
	}
	.summary em {
		color: var(--tx-3);
		font-style: normal;
	}
	.repair-error {
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--ui);
	}
	.row-actions {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
	.row-card {
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid color-mix(in srgb, var(--ui) 55%, transparent);
	}
	.row-card.dup {
		display: flex;
		gap: var(--space-2);
		align-items: baseline;
	}
	.dup-note {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-3);
	}
	.dup-note b {
		color: var(--tx-2);
	}
	.row-head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.row-id {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		font-weight: 600;
		color: var(--tx-2);
		flex: none;
	}
	.cells {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}
	.change {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.35rem;
		margin-top: 0.3rem;
		font-family: var(--font-mono);
		font-size: 0.62rem;
	}
	.field {
		color: var(--tx-3);
		text-transform: uppercase;
		font-size: 0.55rem;
		letter-spacing: 0.05em;
	}
	.from {
		color: var(--error-text);
		text-decoration: line-through;
	}
	.arrow {
		color: var(--tx-3);
	}
	.to {
		color: var(--success-text, #15803d);
		font-weight: 600;
	}
	.reason {
		color: var(--tx-3);
		flex-basis: 100%;
	}
	.accept {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-top: 0.35rem;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-2);
		cursor: pointer;
	}
	.accept input {
		accent-color: var(--primary);
	}
	.review-reason {
		margin-top: 0.3rem;
		font-size: 0.65rem;
		color: var(--tx-3);
		line-height: 1.4;
	}
	.screen-row {
		padding: var(--space-3);
	}
	/* portfolio panel */
	.tiles {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--space-2);
		margin-bottom: var(--space-3);
	}
	.tile {
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		padding: var(--space-2);
		text-align: center;
	}
	.tile.warn {
		border-color: #d97706;
	}
	.tile-value {
		font-family: var(--font-mono);
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--tx);
	}
	.tile.warn .tile-value {
		color: #d97706;
	}
	.tile-label {
		font-family: var(--font-mono);
		font-size: 0.55rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--tx-3);
		margin-top: 0.15rem;
	}
	.rank-head {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tx-3);
		margin-bottom: var(--space-1);
	}
	.rank-row {
		display: flex;
		gap: var(--space-2);
		width: 100%;
		background: none;
		border: none;
		border-bottom: 1px solid color-mix(in srgb, var(--ui) 55%, transparent);
		padding: 0.4rem 0;
		cursor: pointer;
		text-align: left;
	}
	.rank-row:hover {
		background: var(--bg-3);
	}
	.rank-row.active {
		box-shadow: inset 2px 0 0 var(--primary);
		background: var(--bg-3);
	}
	.rank {
		flex: none;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		font-weight: 600;
		color: var(--primary);
		padding-top: 0.1rem;
	}
	.rank-body {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.rank-name {
		font-size: 0.72rem;
		color: var(--tx);
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
	.class-dot {
		width: 9px;
		height: 9px;
		border-radius: 2px;
		display: inline-block;
	}
	.rank-meta {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-3);
	}
	.notes {
		margin-top: var(--space-2);
	}
	.notes p {
		margin: 0 0 0.25rem;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		line-height: 1.5;
		color: #d97706;
	}
	/* ask panel */
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-bottom: var(--space-2);
	}
	.chip {
		background: none;
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-2);
		padding: 0.25rem 0.5rem;
		cursor: pointer;
	}
	.chip:hover:not(:disabled) {
		border-color: var(--primary);
		color: var(--primary);
	}
	.ask-row {
		display: flex;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.ask-row :global(input) {
		flex: 1;
	}
	.turn {
		border-top: 1px solid var(--ui);
		padding-top: var(--space-2);
		margin-top: var(--space-2);
	}
	.q {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--tx-2);
		margin-bottom: 0.35rem;
	}
	.q::before {
		content: '› ';
		color: var(--primary);
	}
	.a {
		font-size: 0.75rem;
		line-height: 1.55;
	}
	.a :global(.prose) {
		display: inline;
	}
	.a :global(.prose p) {
		display: inline;
	}
	.cite {
		display: inline-flex;
		align-items: center;
		background: color-mix(in srgb, var(--primary) 12%, transparent);
		border: 1px solid var(--primary);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--primary);
		padding: 0 0.3rem;
		margin: 0 0.15rem;
		cursor: pointer;
		vertical-align: baseline;
	}
	.dead-cite {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-3);
	}
</style>
