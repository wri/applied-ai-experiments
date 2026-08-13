<script lang="ts">
	import { llm } from '$lib/llm/provider.svelte';
	import GeoJSONSource from '$lib/map/GeoJSONSource.svelte';
	import HoverPopup from '$lib/map/HoverPopup.svelte';
	import { fmtPct, humanize } from '$lib/map/hover';
	import MapLayer from '$lib/map/MapLayer.svelte';
	import { mapStore } from '$lib/map/MapStore.svelte';
	import OverlayPanel from '$lib/shell/OverlayPanel.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { Button } from '@wri-datalab/ui';
	import Panel from '$lib/ui/Panel.svelte';
	import Spinner from '$lib/ui/Spinner.svelte';
	import { Textarea as TextArea } from '@wri-datalab/ui';
	import OvertureScene from '../shared/OvertureScene.svelte';
	import { research, type ResearchStep } from './research.svelte';
	import type { ReportFinding } from './schemas';

	const SUGGESTIONS = [
		'Profile the hospitality economy in view: where do hotels cluster relative to restaurants, and how good is the data?',
		'How exposed is commercial activity to the modelled flood bands?',
		'Audit data confidence: which categories have the weakest evidence here?'
	];

	let question = $state(SUGGESTIONS[0]);
	let visibleSteps = $state<Set<string>>(new Set());

	const STEP_HUES = ['#eab308', '#38bdf8', '#f472b6', '#4ade80', '#c084fc'];

	function start() {
		const b = mapStore.viewport.bounds;
		const raw = b
			? { w: b[0][0], s: b[0][1], e: b[1][0], n: b[1][1] }
			: { w: 105.68, s: 9.98, e: 105.88, n: 10.12 };
		visibleSteps = new Set();
		research.start(question, raw);
	}

	function applyFinding(f: ReportFinding) {
		visibleSteps = new Set([f.stepId]);
		if (f.mapState) mapStore.flyTo(f.mapState);
	}

	function toggleStepLayer(id: string) {
		const next = new Set(visibleSteps);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		visibleSteps = next;
	}

	const pointSteps = $derived(research.steps.filter((s) => s.points));

	function stepGlyph(s: ResearchStep): string {
		switch (s.status) {
			case 'pending':
				return '○';
			case 'done':
				return '✓';
			case 'fallback':
				return '↺';
			case 'error':
				return '✕';
			default:
				return '…';
		}
	}

	const runningStep = $derived(research.steps.find((s) => s.status === 'running') ?? null);
	const stepById = $derived(new Map(research.steps.map((s) => [s.id, s])));

</script>

<OvertureScene show={{ places: false, flood: false }} />

{#each pointSteps as s, i (s.id)}
	{#if visibleSteps.has(s.id)}
		<GeoJSONSource id="research-{s.id}" data={s.points!}>
			<MapLayer
				spec={{
					id: `research-dots-${s.id}`,
					type: 'circle',
					source: `research-${s.id}`,
					paint: {
						'circle-color': STEP_HUES[i % STEP_HUES.length],
						'circle-radius': 4.5,
						'circle-opacity': 0.85,
						'circle-stroke-width': 1,
						'circle-stroke-color': '#1c1a18'
					}
				}}
			/>
		</GeoJSONSource>
	{/if}
{/each}

<HoverPopup
	layers={pointSteps.map((s) => ({
		layerId: `research-dots-${s.id}`,
		title: (p: Record<string, unknown>) => String(p.name ?? 'Result'),
		hitPad: 5,
		fields: [
			{ prop: 'category', label: 'category', format: humanize },
			{ prop: 'confidence', label: 'confidence', format: fmtPct }
		]
	}))}
/>

<OverlayPanel side="left" width="24rem" fill>
	<Panel title="Deep research">
		{#snippet actions()}
			<Badge tone={llm.mode === 'mock' ? 'neutral' : 'primary'}>{llm.mode}</Badge>
		{/snippet}
		<TextArea bind:value={question} rows={3} />
		<div class="chips">
			{#each SUGGESTIONS as s (s)}
				<button class="chip" onclick={() => (question = s)}>{s.slice(0, 44)}…</button>
			{/each}
		</div>
		<div class="row">
			<Button variant="primary" onclick={start} disabled={research.running || !mapStore.loaded}>
				{#if research.running}<Spinner size={12} />{/if}
				{research.running ? 'researching…' : 'start research'}
			</Button>
			{#if research.running}
				<Button variant="ghost" onclick={() => research.cancel()}>cancel</Button>
			{/if}
		</div>
		<p class="note">
			The agent plans, then runs real work in the background: guarded DuckDB-WASM SQL against
			Overture GeoParquet on S3, plus local dataset fetches as API calls. Keep exploring the map —
			or leave the demo — you'll get a toast when the report is filed.
		</p>
	</Panel>

	{#if research.status !== 'idle'}
		<Panel title="Run" padded={false}>
			{#snippet actions()}
				<Badge
					tone={research.status === 'error'
						? 'error'
						: research.status === 'done'
							? 'success'
							: 'info'}
				>
					{research.status}
				</Badge>
			{/snippet}
			{#if research.objective}
				<div class="objective">{research.objective}</div>
			{/if}
			{#each research.steps as s (s.id)}
				<div class="step" class:err={s.status === 'error'}>
					<span class="glyph" data-status={s.status}>
						{#if s.status === 'running'}<Spinner size={10} />{:else}{stepGlyph(s)}{/if}
					</span>
					<div class="step-body">
						<span class="step-title">{s.title}</span>
						<span class="step-meta">
							{#if s.status === 'done' || s.status === 'fallback'}
								{s.rowCount} rows · {s.ms} ms · {s.source}
								{#if s.points}
									<button class="mini" onclick={() => toggleStepLayer(s.id)}>
										{visibleSteps.has(s.id) ? 'hide dots' : 'show dots'}
									</button>
								{/if}
							{:else if s.status === 'error'}
								{s.error}
							{:else}
								{s.kind === 'sql' ? 'sql · s3 geoparquet' : `fetch · ${s.file}`}
							{/if}
						</span>
					</div>
				</div>
			{/each}
			<div class="run-foot">
				<span>{research.elapsed}s elapsed</span>
				{#if research.bboxClamped}<span>viewport clamped to 0.5°</span>{/if}
				{#if research.report && !research.reportOpen}
					<button class="mini" onclick={() => (research.reportOpen = true)}>open report</button>
				{/if}
			</div>
			{#if research.error}
				<p class="error">{research.error}</p>
			{/if}
		</Panel>
	{/if}
</OverlayPanel>

{#if research.running}
	<div class="pill">
		<Spinner size={10} />
		deep research: {research.status}{runningStep ? ` — ${runningStep.title}` : ''}
	</div>
{/if}

{#if research.report && research.reportOpen}
	{@const r = research.report}
	<OverlayPanel side="right" width="26rem" fill>
		<Panel title={r.title}>
			{#snippet actions()}
				<button class="mini" onclick={() => (research.reportOpen = false)}>close</button>
			{/snippet}
			<p class="summary">{r.summary}</p>
			{#each r.findings as f, i (i)}
				{@const step = stepById.get(f.stepId)}
				<div class="finding">
					<p class="finding-text">{f.text}</p>
					<div class="finding-row">
						{#if step}
							<button class="cite-btn" onclick={() => applyFinding(f)}>
								⤢ view: {step.title}
							</button>
							<Badge tone={step.source === 'canned' ? 'warning' : 'neutral'}>
								{step.source}
							</Badge>
						{/if}
					</div>
					{#if step?.sql}
						<details class="sql-peek">
							<summary>the query behind this finding</summary>
							<pre>{step.sql}</pre>
							<span class="sql-meta">{step.rowCount} rows · {step.ms} ms</span>
						</details>
					{/if}
				</div>
			{/each}
			{#if r.caveats?.length}
				<div class="caveats">
					{#each r.caveats as c, i (i)}
						<p>⚠ {c}</p>
					{/each}
				</div>
			{/if}
			<p class="method">
				method: {research.steps.length} planned steps · {research.steps.filter(
					(s) => s.status === 'done'
				).length} live · {research.steps.filter((s) => s.status === 'fallback').length} fallback ·
				plan + synthesis via {llm.mode} model · every finding cites its query
			</p>
		</Panel>
	</OverlayPanel>
{/if}

<style>
	.chips {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-top: var(--space-2);
	}
	.chip {
		background: var(--bg-3);
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-2);
		padding: 0.25rem 0.5rem;
		cursor: pointer;
		text-align: left;
	}
	.chip:hover {
		border-color: var(--primary);
	}
	.row {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
	.note {
		margin: var(--space-3) 0 0;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--tx-3);
		line-height: 1.5;
	}
	.objective {
		padding: var(--space-3);
		font-size: 0.75rem;
		color: var(--tx);
		line-height: 1.5;
		border-bottom: 1px solid var(--ui);
	}
	.step {
		display: flex;
		gap: var(--space-2);
		padding: 0.45rem var(--space-3);
		border-bottom: 1px solid var(--ui);
	}
	.glyph {
		flex: none;
		width: 1rem;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--tx-3);
		padding-top: 0.05rem;
	}
	.glyph[data-status='done'] {
		color: var(--success-text, #4ade80);
	}
	.glyph[data-status='fallback'] {
		color: var(--warning-text);
	}
	.glyph[data-status='error'] {
		color: var(--error-text);
	}
	.step-body {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}
	.step-title {
		font-size: 0.72rem;
		color: var(--tx);
	}
	.step.err .step-title {
		color: var(--tx-2);
	}
	.step-meta {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-3);
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.mini {
		background: none;
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: 0.58rem;
		color: var(--tx-2);
		padding: 0.08rem 0.35rem;
		cursor: pointer;
	}
	.mini:hover {
		border-color: var(--primary);
		color: var(--primary);
	}
	.run-foot {
		display: flex;
		gap: var(--space-3);
		align-items: center;
		padding: 0.45rem var(--space-3);
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-3);
	}
	.error {
		margin: 0;
		padding: 0.45rem var(--space-3);
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		color: var(--error-text);
	}
	.pill {
		position: absolute;
		top: var(--space-4);
		left: 50%;
		transform: translateX(-50%);
		z-index: 30;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		background: color-mix(in srgb, var(--bg) 88%, transparent);
		border: 1px solid var(--ui);
		border-radius: 999px;
		padding: 0.3rem 0.8rem;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-2);
		max-width: 34rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.summary {
		margin: 0 0 var(--space-3);
		font-size: 0.78rem;
		line-height: 1.55;
		color: var(--tx-2);
	}
	.finding {
		border: 1px solid var(--ui);
		border-radius: var(--radius-md);
		padding: var(--space-3);
		margin-bottom: var(--space-3);
		background: var(--bg);
	}
	.finding-text {
		margin: 0;
		font-size: 0.8rem;
		line-height: 1.55;
		color: var(--tx);
	}
	.finding-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
	.cite-btn {
		background: none;
		border: 1px solid var(--ui-2);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--primary);
		padding: 0.25rem 0.5rem;
		cursor: pointer;
	}
	.cite-btn:hover {
		border-color: var(--primary);
	}
	.sql-peek {
		margin-top: var(--space-2);
	}
	.sql-peek summary {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-3);
		cursor: pointer;
	}
	.sql-peek pre {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-2);
		white-space: pre-wrap;
		background: var(--bg-2);
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		padding: var(--space-2);
		margin: var(--space-2) 0 0;
	}
	.sql-meta {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		color: var(--tx-3);
	}
	.caveats p {
		margin: 0 0 var(--space-2);
		font-size: 0.72rem;
		line-height: 1.5;
		color: var(--warning-text);
	}
	.method {
		margin: var(--space-3) 0 0;
		padding-top: var(--space-2);
		border-top: 1px solid var(--ui);
		font-family: var(--font-mono);
		font-size: 0.62rem;
		line-height: 1.5;
		color: var(--tx-3);
	}
</style>
