<script lang="ts">
	import { AgentStore, STATUS_COLORS } from '$lib/agents/AgentStore.svelte';
	import { Sim } from '$lib/agents/sim.svelte';
	import { loadData } from '$lib/data/load';
	import GeoJSONSource from '$lib/map/GeoJSONSource.svelte';
	import HoverPopup from '$lib/map/HoverPopup.svelte';
	import MapLayer from '$lib/map/MapLayer.svelte';
	import { mapStore } from '$lib/map/MapStore.svelte';
	import { farmHoverConfig } from '../shared/zambezi';
	import { llm } from '$lib/llm/provider.svelte';
	import { StructuredOutputError } from '$lib/llm/structured';
	import OverlayPanel from '$lib/shell/OverlayPanel.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { Button } from '@wri-datalab/ui';
	import Panel from '$lib/ui/Panel.svelte';
	import Spinner from '$lib/ui/Spinner.svelte';
	import { Textarea as TextArea } from '@wri-datalab/ui';
	import {
		buildTimelineFromPlan,
		CANNED_PLAN,
		computeNumbers,
		DEFAULT_NUMBERS,
		PLAN_SCHEMA,
		plannerMock,
		tasksFromPlan,
		type BriefingBlock,
		type MapCite,
		type SituationHooks,
		type SituationPlan
	} from './script';
	import type { FilterSpecification } from 'maplibre-gl';

	let sentence = $state(
		'Assess flood exposure for smallholder farms in the lower Zambezi and brief me'
	);

	// context data (declared before buildRun — it reads farmData at init)
	let zambezi = $state.raw<GeoJSON.FeatureCollection | null>(null);
	let farmData = $state.raw<GeoJSON.FeatureCollection | null>(null);
	$effect(() => {
		loadData('zambezi.geojson').then((d) => (zambezi = d));
		loadData('zambezi-farms.geojson').then((d) => (farmData = d));
	});
	let planning = $state(false);
	let plan = $state<SituationPlan | null>(null);
	let planError = $state<string | null>(null);
	let blocks = $state<BriefingBlock[]>([]);
	let flood = $state<MapCite['flood']>('none');
	let farms = $state<MapCite['farms']>('none');
	let activeCite = $state<string | null>(null);
	let headlineVisible = $state(false);

	const hooks: SituationHooks = {
		addBlock: (b) => (blocks = [...blocks, b]),
		reviseBlock: (id, revision) =>
			(blocks = blocks.map((b) => (b.id === id ? { ...b, revision } : b))),
		setLayers: (f, fm) => {
			flood = f;
			farms = fm;
		},
		moveCamera: (c) => mapStore.easeTo(c, 1400),
		showHeadline: () => (headlineVisible = true)
	};

	function clearRun() {
		blocks = [];
		flood = 'none';
		farms = 'none';
		activeCite = null;
		headlineVisible = false;
	}

	// store + sim are rebuilt from each returned plan — the plan's structure,
	// dependencies and timing genuinely drive execution
	function buildRun(p: SituationPlan): { store: AgentStore; sim: Sim } {
		const s = new AgentStore(tasksFromPlan(p));
		const numbers = farmData ? computeNumbers(farmData) : DEFAULT_NUMBERS;
		const timeline = buildTimelineFromPlan(p, s, hooks, numbers);
		return {
			store: s,
			sim: new Sim(timeline, () => {
				s.reset();
				clearRun();
			})
		};
	}

	let run = $state(buildRun(CANNED_PLAN));
	const store = $derived(run.store);
	const sim = $derived(run.sim);

	$effect(() => {
		const s = run.sim;
		return () => s.pause();
	});

	const farmStats = $derived(farmData ? computeNumbers(farmData) : null);

	const floodFilter = $derived.by<FilterSpecification>(() => {
		const scenarios =
			flood === 'both' ? ['current', 'projected'] : flood === 'none' ? [] : [flood];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return ['all', ['==', ['get', 'kind'], 'flood'], ['in', ['get', 'scenario'], ['literal', scenarios]]] as any;
	});

	const farmFilter = $derived.by<FilterSpecification>(() => {
		if (farms === 'exposed') {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return ['in', ['get', 'flood_exposure'], ['literal', ['high', 'medium']]] as any;
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return ['!=', ['get', 'id'], farms === 'none' ? '*' : ''] as any;
	});

	const farmsVisible = $derived(farms !== 'none');

	async function start() {
		if (planning || sim.playing) return;
		planning = true;
		planError = null;
		sim.pause();
		clearRun();
		plan = null;
		try {
			const result = await llm.structured<SituationPlan>(
				{
					system:
						'You are a planner for a multi-agent geospatial situation room. Decompose the request ' +
						'into 3-6 tasks across agents: retrieval, analysis, cartography, critique. The critique ' +
						'agent must red-team claims before anything reaches the user. Use short task ids.',
					messages: [{ role: 'user', content: sentence }],
					maxTokens: 900,
					mock: plannerMock()
				},
				PLAN_SCHEMA
			);
			plan = result.value;
			run = buildRun(result.value);
			run.sim.play();
		} catch (e) {
			planError =
				e instanceof StructuredOutputError
					? `Planner failed: ${e.validationErrors.join('; ')}`
					: (e as Error).message;
		} finally {
			planning = false;
		}
	}

	function applyHeadlineCite(cite: MapCite) {
		flood = cite.flood;
		farms = cite.farms;
		mapStore.flyTo(cite.camera);
	}

	function applyCite(b: BriefingBlock) {
		if (!b.cite) return;
		activeCite = b.id;
		flood = b.cite.flood;
		farms = b.cite.farms;
		mapStore.flyTo(b.cite.camera);
	}

	const auditTrail = $derived(
		store.tasks
			.flatMap((t) => t.log.map((l) => ({ agent: t.name, ...l })))
			.slice()
	);

	const latestActivity = $derived(auditTrail.at(-1) ?? null);
</script>

{#if zambezi}
	<GeoJSONSource id="sz" data={zambezi}>
		<MapLayer
			spec={{
				id: 'sz-flood',
				type: 'fill',
				source: 'sz',
				filter: ['==', ['get', 'kind'], 'flood'],
				paint: {
					'fill-color': ['match', ['get', 'scenario'], 'current', '#0284c7', '#7dd3fc'],
					'fill-opacity': 0.25
				}
			}}
			filter={floodFilter}
		/>
		<MapLayer
			spec={{
				id: 'sz-river',
				type: 'line',
				source: 'sz',
				filter: ['==', ['get', 'kind'], 'river'],
				paint: { 'line-color': '#38bdf8', 'line-width': 2.5, 'line-opacity': 0.85 }
			}}
		/>
	</GeoJSONSource>
{/if}

{#if farmData}
	<GeoJSONSource id="sz-farms" data={farmData}>
		<MapLayer
			spec={{
				id: 'sz-farm-points',
				type: 'circle',
				source: 'sz-farms',
				paint: {
					'circle-color': [
						'match',
						['get', 'flood_exposure'],
						'high',
						'#dc2626',
						'medium',
						'#d97706',
						'#16a34a'
					],
					'circle-radius': 3.5,
					'circle-opacity': 0.85
				},
				layout: { visibility: 'none' }
			}}
			layout={{ visibility: farmsVisible ? 'visible' : 'none' }}
			filter={farmFilter}
		/>
	</GeoJSONSource>
	<HoverPopup layers={farmHoverConfig('sz-farm-points')} />
{/if}

<OverlayPanel side="left" width="24rem" fill>
	<Panel title="The situation room">
		{#snippet actions()}
			<Badge tone={llm.mode === 'mock' ? 'neutral' : 'primary'}>{llm.mode}</Badge>
		{/snippet}
		<TextArea bind:value={sentence} rows={2} />
		<div class="row">
			<Button variant="primary" onclick={start} disabled={planning || sim.playing}>
				{#if planning || sim.playing}<Spinner size={12} />{/if}
				{planning ? 'planning…' : sim.playing ? 'agents running…' : 'plan & execute'}
			</Button>
			{#if sim.progress > 0}
				<Button variant="ghost" onclick={() => sim.reset()}>reset</Button>
			{/if}
		</div>
		{#if planError}<p class="error">{planError}</p>{/if}
		<p class="note">
			The plan comes from the model (structured output) and its structure, dependencies and timing
			genuinely drive execution — independent tasks overlap, dependent ones wait. The finding prose
			is honest simulation templated with numbers computed from the real farm data. Twenty minutes
			compressed into twenty seconds.
		</p>
	</Panel>

	{#if plan}
		<Panel title="Plan" padded={false}>
			<div class="objective">{plan.objective}</div>
			{#each plan.tasks as t (t.id)}
				{@const st = store.task(t.id)?.status ?? 'queued'}
				<div class="plan-task">
					<i style:background={STATUS_COLORS[st]} title={st}></i>
					<div>
						<span class="pt-head"><strong>{t.agent}</strong> · {t.produces}</span>
						<span class="pt-desc">{t.description}</span>
						{#if t.dependsOn.length}<span class="pt-dep">after: {t.dependsOn.join(', ')}</span>{/if}
					</div>
				</div>
			{/each}
		</Panel>
	{/if}

	{#if auditTrail.length}
		<Panel title="Audit trail — who did what" padded={false}>
			<ul class="audit">
				{#each auditTrail as entry, i (i)}
					<li><span class="at">{entry.at}</span> <strong>{entry.agent}</strong> {entry.msg}</li>
				{/each}
			</ul>
		</Panel>
	{/if}
</OverlayPanel>

{#if blocks.length || headlineVisible}
	<OverlayPanel side="right" width="25rem" fill>
		<Panel title="Briefing — flood exposure, lower Zambezi">
			{#if headlineVisible && farmStats}
				<div class="tiles">
					<button
						class="tile"
						onclick={() =>
							applyHeadlineCite({
								label: 'all sites',
								camera: { center: [35.65, -18.05], zoom: 7.6 },
								flood: 'none',
								farms: 'all'
							})}
					>
						<strong>{farmStats.total}</strong><span>registered sites</span>
					</button>
					<button
						class="tile warn"
						onclick={() =>
							applyHeadlineCite({
								label: 'current exposure',
								camera: { center: [35.9, -18.25], zoom: 8.6 },
								flood: 'current',
								farms: 'exposed'
							})}
					>
						<strong>{farmStats.exposedNow}</strong><span>exposed now</span>
					</button>
					<button
						class="tile warn"
						onclick={() =>
							applyHeadlineCite({
								label: 'projected scenario',
								camera: { center: [35.6, -18.05], zoom: 8.2 },
								flood: 'both',
								farms: 'exposed'
							})}
					>
						<strong>{farmStats.projected}</strong><span>projected</span>
					</button>
					<button
						class="tile"
						onclick={() =>
							applyHeadlineCite({
								label: 'current exposure',
								camera: { center: [35.9, -18.25], zoom: 8.6 },
								flood: 'current',
								farms: 'exposed'
							})}
					>
						<strong>~{farmStats.households.toLocaleString()}</strong><span>households</span>
					</button>
				</div>
			{/if}
			{#each blocks as b (b.id)}
				<div class="block {b.kind}" class:active={activeCite === b.id} class:revised={!!b.revision}>
					<div class="block-head">
						<Badge
							tone={b.kind === 'uncertainty' ? 'warning' : b.kind === 'headline' ? 'primary' : 'neutral'}
						>
							{b.kind === 'uncertainty' ? 'caveat' : b.agent}
						</Badge>
						{#if b.revision}
							<Badge tone="warning">revised by critique</Badge>
						{/if}
					</div>
					<p class="block-text">{b.text}</p>
					{#if b.revision}
						<p class="revision">{b.revision}</p>
					{/if}
					{#if b.cite}
						<button class="cite-btn" onclick={() => applyCite(b)}>
							⤢ view: {b.cite.label}
						</button>
					{/if}
				</div>
			{/each}
			{#if sim.playing}
				<div class="streaming-note"><Spinner size={11} /> agents reporting…</div>
			{/if}
		</Panel>
	</OverlayPanel>
{/if}

{#if sim.playing && latestActivity}
	<div class="ticker">
		<Spinner size={10} />
		<strong>{latestActivity.agent}</strong>
		<span>{latestActivity.msg}</span>
	</div>
{/if}

<style>
	.row {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
	.note {
		margin: var(--space-3) 0 0;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--tx-3);
		line-height: 1.5;
	}
	.error {
		margin: var(--space-2) 0 0;
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		color: var(--error-text);
	}
	.objective {
		padding: var(--space-3);
		font-size: 0.75rem;
		color: var(--tx);
		line-height: 1.5;
		border-bottom: 1px solid var(--ui);
	}
	.plan-task {
		display: flex;
		gap: var(--space-2);
		padding: 0.5rem var(--space-3);
		border-bottom: 1px solid var(--ui);
	}
	.plan-task i {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		flex: none;
		margin-top: 0.25rem;
	}
	.pt-head {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--tx);
	}
	.pt-head strong {
		color: var(--primary);
		font-weight: 500;
	}
	.pt-desc {
		display: block;
		font-size: 0.68rem;
		color: var(--tx-2);
		line-height: 1.45;
		margin-top: 0.15rem;
	}
	.pt-dep {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.58rem;
		color: var(--tx-3);
		margin-top: 0.15rem;
	}
	.audit {
		list-style: none;
		margin: 0;
		padding: var(--space-2) 0;
		max-height: 13rem;
		overflow-y: auto;
	}
	.audit li {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-2);
		padding: 0.15rem var(--space-3);
		line-height: 1.45;
	}
	.audit .at {
		color: var(--tx-3);
	}
	.audit strong {
		color: var(--tx);
		font-weight: 500;
	}
	.block {
		border: 1px solid var(--ui);
		border-radius: var(--radius-md);
		padding: var(--space-3);
		margin-bottom: var(--space-3);
		background: var(--bg);
	}
	.block.active {
		border-color: var(--primary);
	}
	.block.headline {
		border-color: color-mix(in srgb, var(--primary) 45%, transparent);
		background: color-mix(in srgb, var(--primary) 6%, var(--bg));
	}
	.block.uncertainty {
		border-color: color-mix(in srgb, var(--warning) 45%, transparent);
	}
	.block-head {
		margin-bottom: var(--space-2);
	}
	.block-text {
		margin: 0;
		font-family: var(--font-body);
		font-size: 0.85rem;
		line-height: 1.6;
		color: var(--tx);
	}
	.cite-btn {
		margin-top: var(--space-2);
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
	.streaming-note {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--tx-3);
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--space-2);
		margin-bottom: var(--space-3);
	}
	.tile {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.1rem;
		background: var(--bg-3);
		border: 1px solid var(--ui);
		border-radius: var(--radius-md);
		padding: 0.45rem 0.6rem;
		cursor: pointer;
		text-align: left;
	}
	.tile:hover {
		border-color: var(--primary);
	}
	.tile strong {
		font-family: var(--font-mono);
		font-size: 1rem;
		font-weight: 600;
		color: var(--tx);
	}
	.tile.warn strong {
		color: var(--warning-text);
	}
	.tile span {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--tx-3);
	}
	.block.revised {
		border-left: 3px solid var(--warning);
	}
	.block-head {
		display: flex;
		gap: var(--space-2);
	}
	.revision {
		margin: var(--space-2) 0 0;
		font-size: 0.75rem;
		font-style: italic;
		line-height: 1.5;
		color: var(--warning-text);
	}
	.ticker {
		position: absolute;
		bottom: var(--space-4);
		left: 50%;
		transform: translateX(-50%);
		z-index: 30;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		max-width: 34rem;
		background: color-mix(in srgb, var(--bg) 88%, transparent);
		border: 1px solid var(--ui);
		border-radius: 999px;
		padding: 0.3rem 0.8rem;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-2);
		white-space: nowrap;
		overflow: hidden;
	}
	.ticker strong {
		color: var(--tx);
		font-weight: 500;
	}
	.ticker span {
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
