<script lang="ts">
	import maplibregl from 'maplibre-gl';
	import { loadData } from '$lib/data/load';
	import { llm } from '$lib/llm/provider.svelte';
	import { StructuredOutputError } from '$lib/llm/structured';
	import GeoJSONSource from '$lib/map/GeoJSONSource.svelte';
	import HoverPopup from '$lib/map/HoverPopup.svelte';
	import { humanize } from '$lib/map/hover';
	import MapLayer from '$lib/map/MapLayer.svelte';
	import { mapStore } from '$lib/map/MapStore.svelte';
	import OverlayPanel from '$lib/shell/OverlayPanel.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { Button } from '@wri-datalab/ui';
	import Panel from '$lib/ui/Panel.svelte';
	import Spinner from '$lib/ui/Spinner.svelte';
	import OvertureScene from '../shared/OvertureScene.svelte';
	import {
		ANOMALY_SYSTEM,
		buildAnomalySchema,
		candidateTable,
		computeCandidates,
		type AnomalyResult,
		type Candidate
	} from './anomalies';
	import { anomalyMock } from './mocks';
	import type { FilterSpecification } from 'maplibre-gl';

	let fc = $state.raw<GeoJSON.FeatureCollection | null>(null);
	$effect(() => {
		loadData('points-embeddings.geojson').then((d) => (fc = d));
	});

	interface Stop {
		id: string;
		headline: string;
		why: string;
		confidence: 'high' | 'medium' | 'low';
		cand: Candidate;
	}

	let scanning = $state(false);
	let scanError = $state<string | null>(null);
	let stops = $state<Stop[]>([]);
	let usedViewport = $state(true);
	let index = $state(-1);
	let walking = $state(false);

	const FLY_MS = 2000;
	const DWELL_MS = 3500;
	const STOP_ZOOM = 15.6;

	const CONF_TONE = { high: 'primary', medium: 'warning', low: 'neutral' } as const;

	async function scan() {
		if (!fc || scanning) return;
		walking = false;
		scanning = true;
		scanError = null;
		stops = [];
		index = -1;
		removeMarker();
		try {
			const { candidates, usedViewport: uv } = computeCandidates(fc, mapStore.viewport.bounds);
			usedViewport = uv;
			const result = await llm.structured<AnomalyResult>(
				{
					system: ANOMALY_SYSTEM,
					maxTokens: 900,
					messages: [
						{
							role: 'user',
							content:
								`Candidates (id | name | category | change | embedding distance):\n` +
								candidateTable(candidates) +
								`\n\nPick the 5 weirdest and explain each.`
						}
					],
					mock: anomalyMock(candidates)
				},
				buildAnomalySchema(candidates.map((c) => c.id))
			);
			const byId = new Map(candidates.map((c) => [c.id, c]));
			stops = result.value.stops.flatMap((s) => {
				const cand = byId.get(s.id);
				return cand ? [{ ...s, cand }] : [];
			});
		} catch (e) {
			scanError =
				e instanceof StructuredOutputError
					? `Anomaly pick rejected: ${e.validationErrors.join('; ')}`
					: (e as Error).message;
		} finally {
			scanning = false;
		}
	}

	// --- the walk ---
	let pulseMarker: maplibregl.Marker | null = null;

	function removeMarker() {
		if (pulseMarker) {
			mapStore.scene.removeMarker(pulseMarker);
			pulseMarker = null;
		}
	}

	function goTo(i: number) {
		const stop = stops[i];
		if (!stop) return;
		index = i;
		mapStore.flyTo({ center: stop.cand.coords, zoom: STOP_ZOOM }, FLY_MS);
		removeMarker();
		const el = document.createElement('div');
		el.className = 'pulse-marker';
		pulseMarker = mapStore.scene.addMarker(
			new maplibregl.Marker({ element: el }).setLngLat(stop.cand.coords)
		);
	}

	async function play() {
		if (walking || !stops.length) return;
		walking = true;
		for (let i = index < 0 || index >= stops.length - 1 ? 0 : index + 1; i < stops.length; i++) {
			if (!walking) break;
			goTo(i);
			await new Promise((r) => setTimeout(r, FLY_MS + DWELL_MS));
		}
		walking = false;
	}

	$effect(() => {
		return () => {
			walking = false;
			removeMarker();
		};
	});

	const stopIds = $derived(stops.map((s) => s.id));
	const stopsFilter = $derived.by<FilterSpecification>(() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return ['in', ['get', 'id'], ['literal', stopIds.length ? stopIds : ['__none__']]] as any;
	});
	const activeFilter = $derived.by<FilterSpecification>(() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return ['==', ['get', 'id'], stops[index]?.id ?? '__none__'] as any;
	});
	const basePaint = $derived({ 'circle-opacity': stops.length ? 0.25 : 0.65 });
</script>

<OvertureScene show={{ flood: false, places: false }} hoverAttributes={false} />

{#if fc}
	<GeoJSONSource id="anomaly-points" data={fc}>
		<MapLayer
			spec={{
				id: 'anomaly-dots',
				type: 'circle',
				source: 'anomaly-points',
				paint: {
					'circle-color': '#8a8378',
					'circle-radius': 2.8,
					'circle-opacity': 0.65
				}
			}}
			paint={basePaint}
		/>
		<MapLayer
			spec={{
				id: 'anomaly-stop-dots',
				type: 'circle',
				source: 'anomaly-points',
				paint: {
					'circle-color': '#eab308',
					'circle-radius': 6,
					'circle-opacity': 0.9,
					'circle-stroke-width': 1.5,
					'circle-stroke-color': '#1c1a18'
				}
			}}
			filter={stopsFilter}
		/>
		<MapLayer
			spec={{
				id: 'anomaly-active-ring',
				type: 'circle',
				source: 'anomaly-points',
				paint: {
					'circle-color': 'transparent',
					'circle-radius': 11,
					'circle-stroke-width': 2.5,
					'circle-stroke-color': '#eab308'
				}
			}}
			filter={activeFilter}
		/>
	</GeoJSONSource>
	<HoverPopup
		layers={[
			{
				layerId: 'anomaly-stop-dots',
				title: (p) => String(p.name ?? 'Point'),
				hitPad: 5,
				fields: [
					{ prop: 'category', label: 'category', format: humanize },
					{ prop: 'change_score', label: 'change score', format: (v) => Number(v).toFixed(2) }
				]
			}
		]}
	/>
{/if}

<OverlayPanel side="right" width="24rem" fill>
	<Panel title="Anomaly walk">
		{#snippet actions()}
			<Badge tone={llm.mode === 'mock' ? 'neutral' : 'primary'}>{llm.mode}</Badge>
		{/snippet}
		<p class="lead">
			“Show me the five weirdest things in view.” Detection is statistics in code — per-category
			z-scores over change activity and embedding position; the model only picks from the
			pre-computed candidates and explains each in checkable terms.
		</p>
		<Button variant="primary" onclick={scan} disabled={scanning || !fc || !mapStore.loaded}>
			{#if scanning}<Spinner size={12} />{/if}
			scan viewport
		</Button>
		{#if scanError}<p class="error">{scanError}</p>{/if}
		{#if stops.length && !usedViewport}
			<p class="note">fewer than 8 points were in view — scanned the whole dataset instead</p>
		{/if}
	</Panel>

	{#if stops.length}
		<Panel title="Stops" padded={false}>
			{#each stops as s, i (s.id)}
				<button class="stop" class:active={index === i} onclick={() => goTo(i)}>
					<span class="rank">{i + 1}</span>
					<span class="stop-body">
						<span class="stop-head">{s.headline}</span>
						<span class="stop-meta">
							<Badge tone={CONF_TONE[s.confidence]}>{s.confidence}</Badge>
							<span class="z">max z {s.cand.combined.toFixed(1)}σ</span>
						</span>
					</span>
				</button>
			{/each}
			<div class="walk-row">
				<Button size="sm" variant="primary" onclick={play} disabled={walking}>
					{walking ? 'walking…' : index >= stops.length - 1 ? 'replay walk' : 'play walk'}
				</Button>
				{#if walking}
					<Button size="sm" variant="ghost" onclick={() => (walking = false)}>stop</Button>
				{/if}
			</div>
		</Panel>
	{/if}
</OverlayPanel>

{#if index >= 0 && stops[index]}
	{@const s = stops[index]}
	<div class="narration">
		<div class="narr-top">
			<span class="narr-count">stop {index + 1}/{stops.length}</span>
			<Badge tone={CONF_TONE[s.confidence]}>{s.confidence}</Badge>
			<span class="narr-cat">{humanize(s.cand.category)}</span>
		</div>
		<div class="narr-head">{s.headline}</div>
		<p class="narr-why">{s.why}</p>
		<div class="narr-controls">
			<button class="nav" disabled={index === 0} onclick={() => goTo(index - 1)}>‹ prev</button>
			<div class="dots">
				{#each stops as d, i (d.id)}
					<button
						class="dot"
						class:on={i === index}
						aria-label={`stop ${i + 1}`}
						onclick={() => goTo(i)}
					></button>
				{/each}
			</div>
			<button class="nav" disabled={index >= stops.length - 1} onclick={() => goTo(index + 1)}>
				next ›
			</button>
		</div>
	</div>
{/if}

<style>
	.lead {
		margin: 0 0 var(--space-3);
		font-size: 0.78rem;
		line-height: 1.55;
		color: var(--tx-2);
	}
	.note {
		margin: var(--space-2) 0 0;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-3);
	}
	.error {
		margin: var(--space-2) 0 0;
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		color: var(--error-text);
	}
	.stop {
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
	.stop:hover {
		background: var(--bg-3);
	}
	.stop.active {
		border-left: 2px solid #eab308;
		background: var(--bg-3);
	}
	.rank {
		flex: none;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		font-weight: 600;
		color: #eab308;
		padding-top: 0.1rem;
	}
	.stop-body {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.stop-head {
		font-size: 0.74rem;
		line-height: 1.4;
		color: var(--tx);
	}
	.stop-meta {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.z {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-3);
	}
	.walk-row {
		display: flex;
		gap: var(--space-2);
		padding: var(--space-3);
	}
	.narration {
		position: absolute;
		bottom: var(--space-4);
		left: 50%;
		transform: translateX(-50%);
		z-index: 30;
		width: min(30rem, calc(100vw - 2rem));
		background: color-mix(in srgb, var(--bg) 92%, transparent);
		border: 1px solid var(--ui);
		border-radius: var(--radius-md);
		padding: var(--space-3);
		box-shadow: var(--shadow-default);
	}
	.narr-top {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.narr-count {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-3);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.narr-cat {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-3);
		margin-left: auto;
	}
	.narr-head {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--tx);
		line-height: 1.4;
	}
	.narr-why {
		margin: var(--space-2) 0 0;
		font-size: 0.75rem;
		line-height: 1.55;
		color: var(--tx-2);
	}
	.narr-controls {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-top: var(--space-3);
	}
	.nav {
		background: none;
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--tx-2);
		padding: 0.2rem 0.5rem;
		cursor: pointer;
	}
	.nav:hover:not(:disabled) {
		border-color: var(--primary);
		color: var(--primary);
	}
	.nav:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.dots {
		display: flex;
		gap: 0.35rem;
		margin: 0 auto;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: none;
		background: var(--ui-2);
		cursor: pointer;
		padding: 0;
	}
	.dot.on {
		background: #eab308;
	}
	:global(.pulse-marker) {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--primary) 35%, transparent);
		border: 2px solid var(--primary);
		animation: pulse 1.4s ease-out infinite;
	}
	@keyframes pulse {
		0% {
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 55%, transparent);
		}
		100% {
			box-shadow: 0 0 0 22px transparent;
		}
	}
</style>
