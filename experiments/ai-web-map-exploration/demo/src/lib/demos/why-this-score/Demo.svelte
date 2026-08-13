<script lang="ts">
	import { loadData } from '$lib/data/load';
	import { llm } from '$lib/llm/provider.svelte';
	import { LlmRun } from '$lib/llm/run.svelte';
	import { StructuredOutputError } from '$lib/llm/structured';
	import GeoJSONSource from '$lib/map/GeoJSONSource.svelte';
	import HoverPopup from '$lib/map/HoverPopup.svelte';
	import MapLayer from '$lib/map/MapLayer.svelte';
	import { mapStore } from '$lib/map/MapStore.svelte';
	import OverlayPanel from '$lib/shell/OverlayPanel.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { Button } from '@wri-datalab/ui';
	import Panel from '$lib/ui/Panel.svelte';
	import { Slider } from '@wri-datalab/ui';
	import Spinner from '$lib/ui/Spinner.svelte';
	import { StreamingMarkdown as StreamedText } from '@wri-datalab/ui';
	import Legend from '../shared/Legend.svelte';
	import {
		DEFAULT_GROUP_WEIGHTS,
		GROUPS,
		INDICATOR_BY_CODE,
		indicatorExpression,
		NO_DATA_COLOR,
		polygonBounds,
		RISK_CLASSES,
		riskClass,
		type GroupId,
		type IndicatorCode
	} from '../shared/waterRisk';
	import { decompose, driverScaleVerdict, indicatorValues, serializeDecomposition } from './decompose';
	import { checklistMock, narrativeMock } from './mocks';
	import ProvenanceRows from './ProvenanceRows.svelte';
	import ScoreCard from './ScoreCard.svelte';
	import {
		AUDIENCE_PROMPTS,
		AUDIENCES,
		CHECKLIST_SCHEMA,
		CHECKLIST_SYSTEM,
		NARRATIVE_SYSTEM,
		type Audience,
		type ChecklistItem,
		type ChecklistResult
	} from './schema';
	import type { FilterSpecification } from 'maplibre-gl';

	const PRESET_NO_DATA = 'None-VNM.25_1-None'; // Cà Mau unit missing 11/13 indicators (real)
	const PRESET_STALE = '441059-VNM.17_1-2021';
	const MODELLED_NOTE =
		'Indicator scores are REAL (public v4 dataset, 2023); aggregation weights are demo defaults, not the official ones.';

	let fc = $state.raw<GeoJSON.FeatureCollection | null>(null);
	$effect(() => {
		loadData('water-risk/basins.geojson').then((d) => (fc = d));
	});

	// --- weights (FEAT-015 at group level: client-side scoring makes this free) ---
	let wQuantity = $state(DEFAULT_GROUP_WEIGHTS.quantity);
	let wQuality = $state(DEFAULT_GROUP_WEIGHTS.quality);
	let wRrr = $state(DEFAULT_GROUP_WEIGHTS.rrr);
	const groupWeights = $derived<Record<GroupId, number>>({
		quantity: wQuantity,
		quality: wQuality,
		rrr: wRrr
	});
	const weightsEdited = $derived(
		wQuantity !== DEFAULT_GROUP_WEIGHTS.quantity ||
			wQuality !== DEFAULT_GROUP_WEIGHTS.quality ||
			wRrr !== DEFAULT_GROUP_WEIGHTS.rrr
	);

	// --- scored FeatureCollection (recomputed live on weight edits) ---
	const scoredFc = $derived.by<GeoJSON.FeatureCollection | null>(() => {
		if (!fc) return null;
		return {
			type: 'FeatureCollection',
			features: fc.features.map((f) => {
				const props = f.properties as Record<string, unknown>;
				const d = decompose(props, groupWeights);
				const top = d.contributions
					.filter((c) => !c.noData)
					.toSorted((a, b) => b.weighted - a.weighted)[0];
				return {
					...f,
					properties: {
						...props,
						overall: Number(d.overall.toFixed(2)),
						top_driver: INDICATOR_BY_CODE[top.code].label
					}
				};
			})
		};
	});

	// --- selection ---
	let selectedId = $state<string | null>(null);
	let focused = $state<IndicatorCode | null>(null);
	let audience = $state<Audience>('analyst');
	let narrativeStale = $state(false);
	const narrative = new LlmRun();

	const selProps = $derived.by(() => {
		if (!selectedId || !fc) return null;
		return (fc.features.find((f) => f.properties?.id === selectedId)?.properties ?? null) as
			| Record<string, unknown>
			| null;
	});
	const decomp = $derived(selProps ? decompose(selProps, groupWeights) : null);
	const selValues = $derived(selProps ? indicatorValues(selProps) : {});

	// --- live scale verdict ---
	const metersPerPixel = $derived(
		(78271.484 / 2 ** mapStore.viewport.zoom) *
			Math.cos((mapStore.viewport.center[1] * Math.PI) / 180)
	);
	const verdict = $derived(decomp ? driverScaleVerdict(decomp, metersPerPixel) : null);

	const VERDICT_UI = {
		screening: { tone: 'success', label: 'screening-grade at this zoom' },
		caution: { tone: 'warning', label: 'approaching the data grain — caution' },
		'not-decision-grade': { tone: 'error', label: 'NOT decision-grade at this zoom' }
	} as const;

	// --- checklist ---
	let checklist = $state<ChecklistItem[] | null>(null);
	let checklistRunning = $state(false);
	let checklistError = $state<string | null>(null);
	let checked = $state<Record<number, boolean>>({});

	const EFFORT_TONE = { desk: 'neutral', field: 'warning', 'agency-contact': 'info' } as const;

	// --- map paint ---
	const OVERALL_COLORS = RISK_CLASSES.map((c) => c.color);
	const fillColor = $derived(
		focused
			? indicatorExpression(focused)
			: [
					'step',
					['get', 'overall'],
					OVERALL_COLORS[0],
					1,
					OVERALL_COLORS[1],
					2,
					OVERALL_COLORS[2],
					3,
					OVERALL_COLORS[3],
					4,
					OVERALL_COLORS[4]
				]
	);
	const selectedFilter = $derived.by<FilterSpecification>(() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return ['==', ['get', 'id'], selectedId ?? '__none__'] as any;
	});

	$effect(() => {
		mapStore.whenReady().then(() => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			mapStore.scene.on('click', 'basins-fill', (e: any) => {
				const id = e.features?.[0]?.properties?.id;
				if (id) selectBasin(String(id));
			});
		});
	});

	$effect(() => () => narrative.abort());

	function selectBasin(id: string, fly = false) {
		if (selectedId === id && !fly) {
			return;
		}
		selectedId = id;
		focused = null;
		checklist = null;
		checklistError = null;
		checked = {};
		if (fly && fc) {
			const f = fc.features.find((x) => x.properties?.id === id);
			if (f) mapStore.fitBounds(polygonBounds(f), 160);
		}
		runNarrative();
	}

	function setAudience(a: Audience) {
		if (audience === a) return;
		audience = a;
		if (selProps) runNarrative();
	}

	function narrativePrompt(): string {
		if (!selProps || !decomp) return '';
		return serializeDecomposition(selProps, decomp, metersPerPixel);
	}

	function runNarrative() {
		if (!selProps || !decomp) return;
		narrativeStale = false;
		narrative.run({
			system: `${NARRATIVE_SYSTEM}\n\n${AUDIENCE_PROMPTS[audience]}`,
			maxTokens: 500,
			messages: [{ role: 'user', content: `Explain this score:\n\n${narrativePrompt()}` }],
			mock: narrativeMock(selProps, decomp, audience)
		});
	}

	async function runChecklist() {
		if (!selProps || !decomp || checklistRunning) return;
		checklistRunning = true;
		checklistError = null;
		try {
			const result = await llm.structured<ChecklistResult>(
				{
					system: CHECKLIST_SYSTEM,
					maxTokens: 900,
					messages: [
						{
							role: 'user',
							content: `Decomposition:\n\n${narrativePrompt()}\n\nProduce the local-validation checklist.`
						}
					],
					mock: checklistMock(decomp)
				},
				CHECKLIST_SCHEMA
			);
			checklist = result.value.items;
			checked = {};
		} catch (e) {
			checklistError =
				e instanceof StructuredOutputError
					? `Checklist rejected: ${e.validationErrors.join('; ')}`
					: (e as Error).message;
		} finally {
			checklistRunning = false;
		}
	}

	// --- presets ---
	const highestRiskId = $derived.by(() => {
		if (!scoredFc) return null;
		let best: string | null = null;
		let bestV = -1;
		for (const f of scoredFc.features) {
			const v = Number(f.properties?.overall);
			if (v > bestV) {
				bestV = v;
				best = String(f.properties?.id);
			}
		}
		return best;
	});

	function resetWeights() {
		wQuantity = DEFAULT_GROUP_WEIGHTS.quantity;
		wQuality = DEFAULT_GROUP_WEIGHTS.quality;
		wRrr = DEFAULT_GROUP_WEIGHTS.rrr;
		narrativeStale = true;
	}

	const legendEntries = $derived(
		focused
			? [
					...RISK_CLASSES.map((c) => ({ color: c.color, label: c.label })),
					{ color: NO_DATA_COLOR, label: 'no data (-9999)' }
				]
			: RISK_CLASSES.map((c) => ({ color: c.color, label: c.label }))
	);
</script>

{#if scoredFc}
	<GeoJSONSource id="basins" data={scoredFc} promoteId="id">
		<MapLayer
			spec={{
				id: 'basins-fill',
				type: 'fill',
				source: 'basins',
				paint: { 'fill-color': '#888888', 'fill-opacity': 0.8 }
			}}
			paint={{ 'fill-color': fillColor }}
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
	<HoverPopup
		layers={[
			{
				layerId: 'basins-fill',
				title: (p) => String(p.name ?? 'Sub-basin'),
				fields: [
					{
						prop: 'overall',
						label: 'overall',
						format: (v) => `${Number(v).toFixed(2)} — ${riskClass(Number(v)).label}`
					},
					{ prop: 'top_driver', label: 'top driver' },
					{ prop: 'note', label: 'source' }
				]
			}
		]}
	/>
{/if}

<Legend
	title={focused ? `indicator — ${INDICATOR_BY_CODE[focused].label}` : 'overall water risk'}
	entries={legendEntries}
	note={MODELLED_NOTE}
/>

{#if selProps}
	<OverlayPanel side="left" width="24rem">
		<Panel title="Data provenance" padded={false}>
			<ProvenanceRows openCode={focused} values={selValues} />
		</Panel>
	</OverlayPanel>
{/if}

<OverlayPanel side="right" width="27rem">
	<Panel title="Why this score?">
		{#snippet actions()}
			<Badge tone={llm.mode === 'mock' ? 'neutral' : 'primary'}>{llm.mode}</Badge>
		{/snippet}
		<p class="lead">
			Click a sub-basin and the score stops being a black box: the weights arithmetic is fully
			visible, the narrative cites only that arithmetic, and the map admits when your zoom
			outruns the data.
		</p>
		<div class="presets">
			<button
				class="preset"
				disabled={!highestRiskId}
				onclick={() => highestRiskId && selectBasin(highestRiskId, true)}
			>
				highest-risk basin
			</button>
			<button class="preset" onclick={() => selectBasin(PRESET_NO_DATA, true)}>
				missing data (-9999)
			</button>
			<button class="preset" onclick={() => selectBasin(PRESET_STALE, true)}>stale score</button>
		</div>
	</Panel>

	{#if selProps && decomp}
		<Panel title={String(selProps.name)}>
			{#snippet actions()}
				{#if selProps?.stale}<Badge tone="warning">stale</Badge>{/if}
				<Badge tone="neutral">{riskClass(decomp?.overall ?? 0).label}</Badge>
			{/snippet}
			{#if selProps.stale}
				<p class="stale-note">{selProps.stale_note}</p>
			{/if}
			<ScoreCard {decomp} {focused} onfocus={(c) => (focused = c)} />
			{#if typeof selProps.official_tot === 'number' && selProps.official_tot !== -9999}
				<p class="official">
					official v4 default weighting scores this unit {Number(selProps.official_tot).toFixed(2)}
					— close to, but not identical with, the simplified demo weights above. Both arithmetics
					are visible; neither is a black box.
				</p>
			{/if}
			<details class="weights">
				<summary>adjust group weights {weightsEdited ? '· edited' : ''}</summary>
				<Slider bind:value={wQuantity} min={0} max={1} step={0.05} label={GROUPS.quantity.label} formatValue={(v) => v.toFixed(2)} />
				<Slider bind:value={wQuality} min={0} max={1} step={0.05} label={GROUPS.quality.label} formatValue={(v) => v.toFixed(2)} />
				<Slider bind:value={wRrr} min={0} max={1} step={0.05} label={GROUPS.rrr.label} formatValue={(v) => v.toFixed(2)} />
				<div class="weights-row">
					<span class="weights-note">weights renormalize automatically; the map recolors live</span>
					{#if weightsEdited}
						<Button size="sm" variant="ghost" onclick={resetWeights}>reset to defaults</Button>
					{/if}
				</div>
			</details>
		</Panel>

		<Panel title="Driver narrative">
			{#snippet actions()}
				{#if narrativeStale}<Badge tone="warning">weights changed</Badge>{/if}
			{/snippet}
			<div class="audience-row">
				{#each AUDIENCES as a (a.id)}
					<button class="chip" class:on={audience === a.id} onclick={() => setAudience(a.id)}>
						{a.label}
					</button>
				{/each}
				<Button size="sm" variant="ghost" onclick={runNarrative} disabled={narrative.isStreaming}>
					regenerate
				</Button>
			</div>
			{#if narrative.error}
				<p class="error">{narrative.error}</p>
			{:else}
				<StreamedText content={narrative.content} streaming={narrative.isStreaming} />
			{/if}
			<details class="peek">
				<summary>the prompt this narrative received</summary>
				<pre>{narrativePrompt()}</pre>
			</details>
		</Panel>

		<Panel title="Fit for this use?">
			{#if verdict}
				<div class="verdict">
					<Badge tone={VERDICT_UI[verdict.level].tone}>{VERDICT_UI[verdict.level].label}</Badge>
				</div>
				<p class="verdict-detail">
					View is ~{Math.round(metersPerPixel)} m/px; the coarsest dominant driver ({verdict.code},
					{INDICATOR_BY_CODE[verdict.code].provenance.resolutionLabel}) spans ~{Math.round(
						verdict.cellSpanPx
					)} screen px per data cell. {#if verdict.level === 'screening'}At this zoom you see the
						data at or above its native grain — fine for screening.{:else if verdict.level === 'caution'}You
						are starting to read detail near the data's native grain — treat spatial patterns with
						care.{:else}You are reading sub-cell detail that does not exist in the data. Zoom out,
						or validate locally before any site-level decision.{/if}
				</p>
				<p class="verdict-note">zoom in and out — this verdict updates live (DL-107/108 pattern)</p>
			{/if}
			<Button variant="primary" size="sm" onclick={runChecklist} disabled={checklistRunning}>
				{#if checklistRunning}<Spinner size={12} />{/if}
				generate local validation checklist
			</Button>
			{#if checklistError}<p class="error">{checklistError}</p>{/if}
			{#if checklist}
				<div class="checklist">
					{#each checklist as item, i (i)}
						<label class="check-item">
							<input
								type="checkbox"
								checked={checked[i] ?? false}
								onchange={() => (checked = { ...checked, [i]: !(checked[i] ?? false) })}
							/>
							<span class="check-body" class:done={checked[i]}>
								<span class="check-head">
									<span class="check-driver">{item.driver}</span>
									{item.action}
									<Badge tone={EFFORT_TONE[item.effort]}>{item.effort}</Badge>
								</span>
								<span class="check-who">who: {item.who}</span>
								<span class="check-why">{item.rationale}</span>
							</span>
						</label>
					{/each}
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
	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.preset {
		background: none;
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--tx-2);
		padding: 0.25rem 0.55rem;
		cursor: pointer;
	}
	.preset:hover:not(:disabled) {
		border-color: var(--primary);
		color: var(--primary);
	}
	.official {
		margin: var(--space-2) 0 0;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		line-height: 1.5;
		color: var(--tx-3);
	}
	.stale-note {
		margin: 0 0 var(--space-2);
		font-size: 0.7rem;
		line-height: 1.5;
		color: var(--warning-text, var(--tx-2));
		border: 1px solid var(--ui);
		border-left: 3px solid #d97706;
		border-radius: var(--radius-sm);
		padding: var(--space-2);
	}
	.weights {
		margin-top: var(--space-3);
		border-top: 1px solid var(--ui);
		padding-top: var(--space-2);
	}
	.weights summary {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tx-3);
		cursor: pointer;
		margin-bottom: var(--space-2);
	}
	.weights-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		margin-top: var(--space-1);
	}
	.weights-note {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		color: var(--tx-3);
		line-height: 1.4;
	}
	.audience-row {
		display: flex;
		align-items: center;
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
		padding: 0.2rem 0.5rem;
		cursor: pointer;
	}
	.chip.on {
		border-color: var(--primary);
		color: var(--tx);
		box-shadow: inset 0 0 0 1px var(--primary);
	}
	.error {
		margin: var(--space-2) 0 0;
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		color: var(--error-text);
	}
	.peek {
		margin-top: var(--space-2);
	}
	.peek summary {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-3);
		cursor: pointer;
	}
	.peek pre {
		margin: var(--space-1) 0 0;
		font-size: 0.58rem;
		line-height: 1.45;
		white-space: pre-wrap;
		background: var(--bg-3);
		border-radius: var(--radius-sm);
		padding: var(--space-2);
		max-height: 14rem;
		overflow: auto;
	}
	.verdict {
		margin-bottom: var(--space-2);
	}
	.verdict-detail {
		margin: 0 0 var(--space-1);
		font-size: 0.72rem;
		line-height: 1.55;
		color: var(--tx-2);
	}
	.verdict-note {
		margin: 0 0 var(--space-3);
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-3);
	}
	.checklist {
		margin-top: var(--space-3);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.check-item {
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
		cursor: pointer;
	}
	.check-item input {
		margin-top: 0.2rem;
		accent-color: var(--primary);
	}
	.check-body {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.check-body.done {
		opacity: 0.5;
	}
	.check-head {
		font-size: 0.72rem;
		line-height: 1.45;
		color: var(--tx);
	}
	.check-driver {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 600;
		color: var(--primary);
		margin-right: 0.25rem;
	}
	.check-who {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-2);
	}
	.check-why {
		font-size: 0.66rem;
		line-height: 1.45;
		color: var(--tx-3);
	}
</style>
