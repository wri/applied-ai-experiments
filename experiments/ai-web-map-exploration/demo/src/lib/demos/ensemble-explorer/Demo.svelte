<script lang="ts">
	import { loadData } from '$lib/data/load';
	import { llm } from '$lib/llm/provider.svelte';
	import { StructuredOutputError } from '$lib/llm/structured';
	import GeoJSONSource from '$lib/map/GeoJSONSource.svelte';
	import HoverPopup from '$lib/map/HoverPopup.svelte';
	import MapLayer from '$lib/map/MapLayer.svelte';
	import { mapStore } from '$lib/map/MapStore.svelte';
	import OverlayPanel from '$lib/shell/OverlayPanel.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { Button } from '@wri-datalab/ui';
	import Panel from '$lib/ui/Panel.svelte';
	import Spinner from '$lib/ui/Spinner.svelte';
	import Legend from '../shared/Legend.svelte';
	import {
		ensembleValues,
		ENSEMBLE_MODELS,
		meanVsupExpression,
		modelExpression,
		MODEL_COLORS,
		MODEL_LABELS,
		NO_DATA,
		NO_DATA_COLOR,
		polygonBounds,
		RISK_CLASSES,
		SCENARIO_LABELS,
		spreadExpression,
		WATER_RISK_HOVER_LAYERS,
		type Agreement,
		type EnsembleModel,
		type ScenarioPrefix
	} from '../shared/waterRisk';
	import BasinStrip from './BasinStrip.svelte';
	import BivariateLegend from './BivariateLegend.svelte';
	import { guidanceMock } from './mocks';
	import { GUIDANCE_SCHEMA, GUIDANCE_SYSTEM, guidanceContext, type GuidanceReport } from './schema';
	import type { FilterSpecification } from 'maplibre-gl';

	const MODELLED_NOTE =
		'Baseline indicator scores are REAL (public v4 dataset, 2023). The 5-model ensemble is MODELLED around them — model names echo ISIMIP; gray = the real dataset has no score here.';

	let fc = $state.raw<GeoJSON.FeatureCollection | null>(null);
	$effect(() => {
		loadData('water-risk/basins.geojson').then((d) => (fc = d));
	});

	type Mode = 'mean' | 'spread' | 'model';
	let scenario = $state<ScenarioPrefix>('bws');
	let mode = $state<Mode>('mean');
	let activeModel = $state<EnsembleModel>('h08');
	let cycling = $state(false);
	let selectedId = $state<string | null>(null);
	let cautionActive = $state(false);
	let tourIndex = $state(-1);

	// guidance call state
	let guidance = $state<GuidanceReport | null>(null);
	let guidanceFor = $state<string>('');
	let running = $state(false);
	let guidanceError = $state<string | null>(null);

	const POSITION_LABEL = { drier: 'drier (more stress)', wetter: 'wetter (less stress)', middle: 'middle' } as const;
	const CONF_TONE = { high: 'success', medium: 'warning', low: 'error' } as const;
	const AGREE_TONE: Record<Agreement, 'success' | 'warning' | 'error' | 'neutral'> = {
		high: 'success',
		medium: 'warning',
		low: 'error',
		nodata: 'neutral'
	};

	// --- map paint (pure expressions over precomputed flat props) ---
	const fillColor = $derived(
		mode === 'mean'
			? meanVsupExpression(scenario)
			: mode === 'spread'
				? spreadExpression(scenario)
				: modelExpression(scenario, activeModel)
	);
	const cautionIds = $derived.by(() => {
		if (!fc) return [];
		return fc.features
			.filter((f) => f.properties?.[`${scenario}_caution`] === 1)
			.toSorted(
				(a, b) => Number(b.properties?.[`${scenario}_range`]) - Number(a.properties?.[`${scenario}_range`])
			)
			.slice(0, 5)
			.map((f) => String(f.properties?.id));
	});
	const fillOpacity = $derived(
		cautionActive && cautionIds.length
			? ['case', ['in', ['get', 'id'], ['literal', cautionIds]], 0.9, 0.22]
			: 0.82
	);
	const lowAgreeFilter = $derived.by<FilterSpecification>(() => {
		if (mode !== 'mean') {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return ['==', ['get', 'id'], '__none__'] as any;
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return ['==', ['get', `${scenario}_agreement`], 'low'] as any;
	});
	const selectedFilter = $derived.by<FilterSpecification>(() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return ['==', ['get', 'id'], selectedId ?? '__none__'] as any;
	});

	// --- selection ---
	const selected = $derived(
		selectedId && fc ? (fc.features.find((f) => f.properties?.id === selectedId) ?? null) : null
	);
	const selProps = $derived(selected?.properties as Record<string, unknown> | undefined);
	const selNoData = $derived(selProps ? Number(selProps[`${scenario}_mean`]) === NO_DATA : false);

	$effect(() => {
		mapStore.whenReady().then(() => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			mapStore.scene.on('click', 'basins-fill', (e: any) => {
				const id = e.features?.[0]?.properties?.id;
				if (!id) return;
				selectedId = selectedId === id ? null : String(id);
				guidance = null;
				guidanceError = null;
			});
		});
	});

	function selectBasin(id: string, fly = false) {
		selectedId = id;
		guidance = null;
		guidanceError = null;
		const f = fc?.features.find((x) => x.properties?.id === id);
		if (f && fly) mapStore.fitBounds(polygonBounds(f), 140);
	}

	function setScenario(p: ScenarioPrefix) {
		scenario = p;
		guidance = null;
		guidanceError = null;
		tourIndex = -1;
	}

	// --- model cycling (the watch-the-map-flicker moment) ---
	$effect(() => {
		if (!cycling || mode !== 'model') return;
		const t = setInterval(() => {
			const i = ENSEMBLE_MODELS.indexOf(activeModel);
			activeModel = ENSEMBLE_MODELS[(i + 1) % ENSEMBLE_MODELS.length];
		}, 700);
		return () => clearInterval(t);
	});

	// --- caution tour ---
	function goTour(i: number) {
		const id = cautionIds[i];
		if (!id) return;
		tourIndex = i;
		selectBasin(id, true);
	}

	// --- guidance ---
	async function runGuidance() {
		if (!selProps || running) return;
		running = true;
		guidanceError = null;
		guidance = null;
		try {
			const result = await llm.structured<GuidanceReport>(
				{
					system: GUIDANCE_SYSTEM,
					maxTokens: 900,
					messages: [
						{
							role: 'user',
							content: `Basin ensemble result:\n${guidanceContext(selProps, scenario)}\n\nProduce the decision guidance.`
						}
					],
					mock: guidanceMock(selProps, scenario)
				},
				GUIDANCE_SCHEMA
			);
			guidance = result.value;
			guidanceFor = `${selProps.id} · ${SCENARIO_LABELS[scenario]}`;
		} catch (e) {
			guidanceError =
				e instanceof StructuredOutputError
					? `Guidance rejected: ${e.validationErrors.join('; ')}`
					: (e as Error).message;
		} finally {
			running = false;
		}
	}

	const spreadLegend = [
		{ color: '#efeae3', label: 'models agree (range 0)' },
		{ color: '#b8a6d9', label: 'range ≈ 1' },
		{ color: '#7c5cbf', label: 'range ≈ 2' },
		{ color: '#4c1d95', label: 'range ≥ 3.5 (disagree)' },
		{ color: NO_DATA_COLOR, label: 'no data in the real baseline' }
	];
	const modelLegend = $derived([
		...RISK_CLASSES.map((c) => ({ color: c.color, label: c.label })),
		{ color: NO_DATA_COLOR, label: 'no data in the real baseline' }
	]);
</script>

{#if fc}
	<GeoJSONSource id="basins" data={fc} promoteId="id">
		<MapLayer
			spec={{
				id: 'basins-fill',
				type: 'fill',
				source: 'basins',
				paint: { 'fill-color': '#888888', 'fill-opacity': 0.82 }
			}}
			paint={{ 'fill-color': fillColor, 'fill-opacity': fillOpacity }}
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
				id: 'basins-lowagree',
				type: 'line',
				source: 'basins',
				paint: { 'line-color': '#4b4237', 'line-width': 1.6, 'line-dasharray': [2, 2] }
			}}
			filter={lowAgreeFilter}
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
	<HoverPopup layers={WATER_RISK_HOVER_LAYERS} />
{/if}

{#if mode === 'mean'}
	<BivariateLegend note={MODELLED_NOTE} />
{:else if mode === 'spread'}
	<Legend title="model spread ({SCENARIO_LABELS[scenario]})" entries={spreadLegend} note={MODELLED_NOTE} />
{:else}
	<Legend title="single model — {MODEL_LABELS[activeModel]}" entries={modelLegend} note={MODELLED_NOTE} />
{/if}

<OverlayPanel side="right" width="26rem">
	<Panel title="Ensemble explorer">
		{#snippet actions()}
			<Badge tone={llm.mode === 'mock' ? 'neutral' : 'primary'}>{llm.mode}</Badge>
		{/snippet}
		<p class="lead">
			Five hydrological models, one map. Where models agree the risk colors are vivid; where they
			disagree the hue washes toward neutral — the map refuses to overstate. Click a basin to see
			the models argue.
		</p>
		<div class="control-row">
			<span class="control-label">scenario</span>
			<div class="segmented">
				<button class:on={scenario === 'bws'} onclick={() => setScenario('bws')}>Baseline</button>
				<button class:on={scenario === 'fut'} onclick={() => setScenario('fut')}>2050</button>
			</div>
		</div>
		<div class="control-row">
			<span class="control-label">view</span>
			<div class="segmented">
				<button class:on={mode === 'mean'} onclick={() => (mode = 'mean')}>ensemble mean</button>
				<button class:on={mode === 'spread'} onclick={() => (mode = 'spread')}>spread</button>
				<button class:on={mode === 'model'} onclick={() => (mode = 'model')}>single model</button>
			</div>
		</div>
		{#if mode === 'model'}
			<div class="control-row">
				<span class="control-label">model</span>
				<div class="model-chips">
					{#each ENSEMBLE_MODELS as m (m)}
						<button
							class="chip"
							class:on={activeModel === m}
							style:--chip-color={MODEL_COLORS[m]}
							onclick={() => {
								activeModel = m;
								cycling = false;
							}}
						>
							{MODEL_LABELS[m]}
						</button>
					{/each}
					<button class="chip cycle" class:on={cycling} onclick={() => (cycling = !cycling)}>
						{cycling ? '■ stop' : '▶ cycle'}
					</button>
				</div>
			</div>
			<p class="note">
				cycling the models is the point — watch the divergent basins flip class while consensus
				basins hold still
			</p>
		{/if}
		<div class="distrust-row">
			<Button
				variant={cautionActive ? 'secondary' : 'primary'}
				size="sm"
				onclick={() => {
					cautionActive = !cautionActive;
					tourIndex = -1;
				}}
				disabled={!fc}
			>
				{cautionActive ? 'clear highlight' : 'where should I not trust the mean?'}
			</Button>
		</div>
	</Panel>

	{#if cautionActive}
		<Panel title="Don't trust the mean here" padded={false}>
			{#if cautionIds.length === 0}
				<p class="empty">
					No basins flagged under {SCENARIO_LABELS[scenario]} — every low-agreement basin is
					clearly low or high risk anyway.
				</p>
			{:else}
				{#each cautionIds as id, i (id)}
					{@const f = fc?.features.find((x) => x.properties?.id === id)}
					{#if f?.properties}
						<button class="caution-row" class:active={tourIndex === i} onclick={() => goTour(i)}>
							<span class="rank">{i + 1}</span>
							<span class="c-body">
								<span class="c-name">{f.properties.name}</span>
								<span class="c-meta">
									mean {Number(f.properties[`${scenario}_mean`]).toFixed(2)} looks moderate — models span
									{Number(f.properties[`${scenario}_min`]).toFixed(1)}–{Number(
										f.properties[`${scenario}_max`]
									).toFixed(1)}
								</span>
							</span>
						</button>
					{/if}
				{/each}
				<div class="tour-row">
					<Button size="sm" variant="ghost" disabled={tourIndex <= 0} onclick={() => goTour(tourIndex - 1)}>
						‹ prev
					</Button>
					<Button
						size="sm"
						variant="primary"
						disabled={tourIndex >= cautionIds.length - 1}
						onclick={() => goTour(tourIndex + 1)}
					>
						{tourIndex < 0 ? 'start tour' : 'next ›'}
					</Button>
				</div>
			{/if}
		</Panel>
	{/if}

	{#if selProps}
		<Panel title={String(selProps.name)}>
			{#snippet actions()}
				<Badge tone={AGREE_TONE[String(selProps[`${scenario}_agreement`]) as Agreement]}>
					{selProps[`${scenario}_agreement`]} agreement
				</Badge>
			{/snippet}
			{#if selNoData}
				<p class="nodata-note">
					The real baseline dataset has no score for this unit (insufficient input data), so the
					modelled ensemble abstains too — an honest gap, not low risk.
				</p>
			{:else}
				<div class="sel-head">
					<span class="sel-score">{Number(selProps[`${scenario}_mean`]).toFixed(2)}</span>
					<span class="sel-class">
						{RISK_CLASSES[Number(selProps[`${scenario}_class`])].label} · {SCENARIO_LABELS[scenario]}
					</span>
				</div>
				<BasinStrip
					values={ensembleValues(selProps, scenario)}
					mean={Number(selProps[`${scenario}_mean`])}
					min={Number(selProps[`${scenario}_min`])}
					max={Number(selProps[`${scenario}_max`])}
					agreement={String(selProps[`${scenario}_agreement`]) as Agreement}
				/>
				<div class="guidance-actions">
					<Button variant="primary" size="sm" onclick={runGuidance} disabled={running}>
						{#if running}<Spinner size={12} />{/if}
						get decision guidance
					</Button>
				</div>
				{#if guidanceError}<p class="error">{guidanceError}</p>{/if}
			{/if}
		</Panel>
	{/if}

	{#if guidance}
		<Panel title="Decision guidance">
			{#snippet actions()}
				<Badge tone={CONF_TONE[guidance?.confidence ?? 'low']}>{guidance?.confidence} confidence</Badge>
			{/snippet}
			<div class="g-for">{guidanceFor}</div>
			<div class="g-headline">{guidance.headline}</div>
			<p class="g-summary">{guidance.signal_summary}</p>
			<div class="takes">
				<div class="take">
					<div class="take-title">screening</div>
					<p>{guidance.screening_take}</p>
				</div>
				<div class="take">
					<div class="take-title">siting</div>
					<p>{guidance.siting_take}</p>
				</div>
			</div>
			<div class="g-section">model divergence</div>
			{#each guidance.divergence as d (d.model)}
				<div class="div-row">
					<i style:background={MODEL_COLORS[d.model]}></i>
					<span class="div-model">{MODEL_LABELS[d.model]}</span>
					<span class="div-pos">{POSITION_LABEL[d.position]}</span>
					<span class="div-note">{d.note}</span>
				</div>
			{/each}
			<div class="g-section">what would resolve this</div>
			<ul class="resolve">
				{#each guidance.what_would_resolve as r, i (i)}
					<li>{r}</li>
				{/each}
			</ul>
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
	.control-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.control-label {
		flex: none;
		width: 4rem;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tx-3);
	}
	.segmented {
		display: flex;
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.segmented button {
		background: none;
		border: none;
		border-right: 1px solid var(--ui);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--tx-2);
		padding: 0.25rem 0.55rem;
		cursor: pointer;
	}
	.segmented button:last-child {
		border-right: none;
	}
	.segmented button.on {
		background: var(--bg-3);
		color: var(--tx);
		font-weight: 600;
	}
	.model-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		background: none;
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-2);
		padding: 0.2rem 0.45rem;
		cursor: pointer;
	}
	.chip.on {
		border-color: var(--chip-color, var(--primary));
		color: var(--tx);
		box-shadow: inset 0 0 0 1px var(--chip-color, var(--primary));
	}
	.chip.cycle.on {
		border-color: var(--primary);
		box-shadow: inset 0 0 0 1px var(--primary);
	}
	.note {
		margin: var(--space-1) 0 var(--space-2);
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-3);
		line-height: 1.5;
	}
	.distrust-row {
		margin-top: var(--space-2);
	}
	.empty {
		margin: 0;
		padding: var(--space-3);
		font-size: 0.72rem;
		color: var(--tx-3);
	}
	.caution-row {
		display: flex;
		gap: var(--space-2);
		width: 100%;
		background: none;
		border: none;
		border-bottom: 1px solid var(--ui);
		padding: 0.5rem var(--space-3);
		cursor: pointer;
		text-align: left;
	}
	.caution-row:hover {
		background: var(--bg-3);
	}
	.caution-row.active {
		border-left: 2px solid var(--primary);
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
	.c-body {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.c-name {
		font-size: 0.74rem;
		color: var(--tx);
	}
	.c-meta {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-3);
		line-height: 1.4;
	}
	.tour-row {
		display: flex;
		gap: var(--space-2);
		padding: var(--space-3);
	}
	.nodata-note {
		margin: 0;
		font-size: 0.72rem;
		line-height: 1.55;
		color: var(--tx-2);
	}
	.sel-head {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.sel-score {
		font-family: var(--font-mono);
		font-size: 1.3rem;
		font-weight: 600;
		color: var(--tx);
	}
	.sel-class {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--tx-2);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.guidance-actions {
		margin-top: var(--space-3);
	}
	.error {
		margin: var(--space-2) 0 0;
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		color: var(--error-text);
	}
	.g-for {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-3);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: var(--space-1);
	}
	.g-headline {
		font-size: 0.85rem;
		font-weight: 500;
		line-height: 1.4;
		color: var(--tx);
	}
	.g-summary {
		margin: var(--space-2) 0;
		font-size: 0.75rem;
		line-height: 1.55;
		color: var(--tx-2);
	}
	.takes {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.take {
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		padding: var(--space-2);
	}
	.take-title {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tx-3);
		margin-bottom: 0.25rem;
	}
	.take p {
		margin: 0;
		font-size: 0.7rem;
		line-height: 1.5;
		color: var(--tx-2);
	}
	.g-section {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tx-3);
		margin: var(--space-2) 0 var(--space-1);
	}
	.div-row {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		padding: 0.2rem 0;
		font-size: 0.7rem;
	}
	.div-row i {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex: none;
		align-self: center;
	}
	.div-model {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		font-weight: 600;
		color: var(--tx);
		flex: none;
	}
	.div-pos {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-3);
		flex: none;
	}
	.div-note {
		color: var(--tx-2);
		line-height: 1.45;
	}
	.resolve {
		margin: 0;
		padding-left: 1.1rem;
	}
	.resolve li {
		font-size: 0.72rem;
		line-height: 1.5;
		color: var(--tx-2);
		margin-bottom: 0.25rem;
	}
</style>
