<script lang="ts">
	import { AgentStore, STATUS_COLORS, STATUS_LABELS, type AssetPayload } from '$lib/agents/AgentStore.svelte';
	import AssetViewer from '$lib/agents/AssetViewer.svelte';
	import { Sim } from '$lib/agents/sim.svelte';
	import { loadData } from '$lib/data/load';
	import GeoJSONSource from '$lib/map/GeoJSONSource.svelte';
	import HoverPopup from '$lib/map/HoverPopup.svelte';
	import MapLayer from '$lib/map/MapLayer.svelte';
	import { mapStore } from '$lib/map/MapStore.svelte';
	import { farmHoverConfig } from '../shared/zambezi';
	import OverlayPanel from '$lib/shell/OverlayPanel.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { Button } from '@wri-datalab/ui';
	import Panel from '$lib/ui/Panel.svelte';
	import Kanban from './Kanban.svelte';
	import { buildTimeline, TASKS, type FarmState, type FloodState } from './script';
	import type { FilterSpecification } from 'maplibre-gl';

	// layer state is set explicitly by the script (and by applying map-state
	// assets) — not inferred from asset presence
	let flood = $state<FloodState>('none');
	let farmState = $state<FarmState>('none');
	let handoff = $state<{ from: string; to: string } | null>(null);

	const store = new AgentStore(TASKS);
	const sim = new Sim(
		buildTimeline(store, {
			setLayers: (f, fm) => {
				flood = f;
				farmState = fm;
			},
			setHandoff: (edge) => (handoff = edge)
		}),
		() => {
			store.reset();
			flood = 'none';
			farmState = 'none';
			handoff = null;
			applyStash = null;
		}
	);

	$effect(() => {
		return () => sim.pause();
	});

	let view = $state<'map' | 'kanban'>('map');

	// context layers
	let zambezi = $state.raw<GeoJSON.FeatureCollection | null>(null);
	let farms = $state.raw<GeoJSON.FeatureCollection | null>(null);
	$effect(() => {
		loadData('zambezi.geojson').then((d) => (zambezi = d));
		loadData('zambezi-farms.geojson').then((d) => (farms = d));
	});

	const floodFilter = $derived.by<FilterSpecification>(() => {
		const scenarios = flood === 'both' ? ['current', 'projected'] : flood === 'none' ? [] : [flood];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return ['all', ['==', ['get', 'kind'], 'flood'], ['in', ['get', 'scenario'], ['literal', scenarios]]] as any;
	});

	const farmFilter = $derived.by<FilterSpecification>(() => {
		if (farmState === 'exposed') {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return ['in', ['get', 'flood_exposure'], ['literal', ['high', 'medium']]] as any;
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return ['!=', ['get', 'id'], ''] as any;
	});

	// apply/revert for map-state assets: stash what the run had before applying
	let applyStash = $state<{ center: [number, number]; zoom: number; flood: FloodState; farms: FarmState } | null>(null);

	function applyAsset(p: Extract<AssetPayload, { type: 'map-state' }>) {
		applyStash ??= {
			center: [...mapStore.viewport.center] as [number, number],
			zoom: mapStore.viewport.zoom,
			flood,
			farms: farmState
		};
		if (p.layers.flood) flood = p.layers.flood as FloodState;
		if (p.layers.farms) farmState = p.layers.farms as FarmState;
		mapStore.flyTo({ center: p.camera.center, zoom: p.camera.zoom });
	}

	function revertAsset() {
		if (!applyStash) return;
		flood = applyStash.flood;
		farmState = applyStash.farms;
		mapStore.flyTo({ center: applyStash.center, zoom: applyStash.zoom });
		applyStash = null;
	}

	const aoiData = $derived(store.aoiPolygons());
	const depsData = $derived(store.dependencyEdges());

	const handoffFilter = $derived.by<FilterSpecification>(() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return [
			'all',
			['==', ['get', 'from'], handoff?.from ?? ''],
			['==', ['get', 'to'], handoff?.to ?? '']
		] as any;
	});

	const statusColorExpr = [
		'match',
		['get', 'status'],
		...Object.entries(STATUS_COLORS).flat(),
		'#888888'
	];

	const selectedFilter = $derived.by<FilterSpecification>(() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return ['==', ['get', 'id'], store.selectedId ?? ''] as any;
	});

	// click AOI on the map → select the card
	$effect(() => {
		let disposed = false;
		mapStore.whenReady().then(() => {
			if (disposed) return;
			mapStore.scene.on('click', 'aoi-fill', (e) => {
				const id = e.features?.[0]?.properties?.id;
				if (id) store.selectedId = store.selectedId === id ? null : String(id);
			});
		});
		return () => {
			disposed = true;
		};
	});

	function frameSelected() {
		const t = store.selected;
		if (!t) return;
		mapStore.fitBounds([
			[t.aoi[0], t.aoi[1]],
			[t.aoi[2], t.aoi[3]]
		]);
	}
</script>

{#if zambezi}
	<GeoJSONSource id="zambezi" data={zambezi}>
		<MapLayer
			spec={{
				id: 'zambezi-flood',
				type: 'fill',
				source: 'zambezi',
				filter: ['==', ['get', 'kind'], 'flood'],
				paint: {
					'fill-color': ['match', ['get', 'scenario'], 'current', '#0284c7', '#7dd3fc'],
					'fill-opacity': 0.22
				},
				layout: { visibility: 'none' }
			}}
			layout={{ visibility: flood !== 'none' ? 'visible' : 'none' }}
			filter={floodFilter}
		/>
		<MapLayer
			spec={{
				id: 'zambezi-river',
				type: 'line',
				source: 'zambezi',
				filter: ['==', ['get', 'kind'], 'river'],
				paint: { 'line-color': '#38bdf8', 'line-width': 2.5, 'line-opacity': 0.85 }
			}}
		/>
	</GeoJSONSource>
{/if}

{#if farms}
	<GeoJSONSource id="farms" data={farms}>
		<MapLayer
			spec={{
				id: 'farm-points',
				type: 'circle',
				source: 'farms',
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
					'circle-opacity': 0.8
				},
				layout: { visibility: 'none' }
			}}
			layout={{ visibility: farmState !== 'none' ? 'visible' : 'none' }}
			filter={farmFilter}
		/>
	</GeoJSONSource>
	<HoverPopup layers={farmHoverConfig('farm-points')} disabled={view === 'kanban'} />
{/if}

<GeoJSONSource id="deps" data={depsData}>
	<MapLayer
		spec={{
			id: 'dep-edges',
			type: 'line',
			source: 'deps',
			paint: {
				'line-color': '#706a64',
				'line-width': 1,
				'line-dasharray': [1, 3],
				'line-opacity': 0.5
			}
		}}
	/>
	<MapLayer
		spec={{
			id: 'dep-active',
			type: 'line',
			source: 'deps',
			paint: { 'line-color': '#eab308', 'line-width': 2.5 }
		}}
		filter={handoffFilter}
	/>
</GeoJSONSource>

<GeoJSONSource id="aoi" data={aoiData}>
	<MapLayer
		spec={{
			id: 'aoi-fill',
			type: 'fill',
			source: 'aoi',
			paint: {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				'fill-color': statusColorExpr as any,
				'fill-opacity': 0.08
			}
		}}
	/>
	<MapLayer
		spec={{
			id: 'aoi-line',
			type: 'line',
			source: 'aoi',
			paint: {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				'line-color': statusColorExpr as any,
				'line-width': 1.5,
				'line-dasharray': [3, 2]
			}
		}}
	/>
	<MapLayer
		spec={{
			id: 'aoi-selected',
			type: 'line',
			source: 'aoi',
			paint: { 'line-color': '#eab308', 'line-width': 3 }
		}}
		filter={selectedFilter}
	/>
</GeoJSONSource>

{#if view === 'kanban'}
	<div class="kanban-surface">
		<Kanban {store} />
	</div>
{/if}

<div class="topbar">
	<div class="switch">
		<button class:active={view === 'map'} onclick={() => (view = 'map')}>map</button>
		<button class:active={view === 'kanban'} onclick={() => (view = 'kanban')}>kanban</button>
	</div>
	<div class="sim-controls">
		{#if sim.playing}
			<Button size="sm" onclick={() => sim.pause()}>pause</Button>
		{:else}
			<Button size="sm" variant="primary" onclick={() => sim.play()}>
				{sim.finished ? 'replay' : sim.progress > 0 ? 'resume' : 'run agents'}
			</Button>
		{/if}
		<Button size="sm" variant="ghost" onclick={() => sim.reset()}>reset</Button>
		<span class="progress">{sim.progress}/{sim.total} events</span>
	</div>
</div>

<OverlayPanel side="right" width="21.5rem">
	{#if view === 'map'}
		<Panel title="Agents" padded={false}>
			{#each store.tasks as t (t.id)}
				<button
					class="agent-row"
					class:selected={store.selectedId === t.id}
					onclick={() => {
						store.selectedId = store.selectedId === t.id ? null : t.id;
					}}
				>
					<i style:background={STATUS_COLORS[t.status]}></i>
					<span class="agent-name">{t.name}</span>
					<span class="agent-status">{STATUS_LABELS[t.status]}</span>
				</button>
			{/each}
			<p class="hint">
				Selection is shared state — pick an agent here or click its footprint on the map, then
				switch to kanban: the same card is selected. Assets the agents produce are inspectable
				objects — click one to open it; map-state assets can be applied to the live map and
				reverted. Dashed lines between footprints are the plan's dependency graph; an edge lights
				up while an artifact hands off. Watch ~30s in: the audit agent bounces the map series back
				to cartography.
			</p>
		</Panel>
	{/if}

	{#if store.selected}
		{@const t = store.selected}
		<Panel title={t.name}>
			{#snippet actions()}
				<Badge>{t.role}</Badge>
				{#if view === 'map'}<Button size="sm" onclick={frameSelected}>frame</Button>{/if}
			{/snippet}
			<p class="sel-desc">{t.description}</p>
			{#if t.dependsOn?.length}
				<div class="dep">depends on: {t.dependsOn.join(', ')}</div>
			{/if}
			{#if t.assets.length}
				<div class="label">assets</div>
				<ul class="asset-list">
					{#each t.assets as a (a.id)}
						<li>
							<button
								class="asset-open"
								onclick={() => (store.openAsset = { taskId: t.id, assetId: a.id })}
							>
								<strong>{a.name}</strong> <span>{a.detail}</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
			{#if t.log.length}
				<div class="label">log</div>
				<ul class="log">
					{#each t.log as entry, i (i)}
						<li><span class="at">{entry.at}</span> {entry.msg}</li>
					{/each}
				</ul>
			{/if}
		</Panel>
	{/if}
</OverlayPanel>

<AssetViewer {store} onApply={applyAsset} onRevert={revertAsset} />

<style>
	.topbar {
		position: absolute;
		top: var(--space-4);
		left: 50%;
		transform: translateX(-50%);
		z-index: 30;
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.switch {
		display: flex;
		background: var(--bg-2);
		border: 1px solid var(--ui);
		border-radius: var(--radius-md);
		overflow: hidden;
	}
	.switch button {
		background: none;
		border: none;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--tx-2);
		padding: 0.35rem 0.9rem;
		cursor: pointer;
	}
	.switch button.active {
		background: var(--primary);
		color: var(--primary-content);
		font-weight: 500;
	}
	.sim-controls {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		background: color-mix(in srgb, var(--bg) 85%, transparent);
		border: 1px solid var(--ui);
		border-radius: var(--radius-md);
		padding: 0.25rem 0.5rem;
	}
	.progress {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-3);
	}
	.kanban-surface {
		position: absolute;
		inset: 0;
		z-index: 25;
		background: var(--bg);
		padding: 4.2rem var(--space-4) var(--space-4);
		overflow: hidden;
	}
	.agent-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		background: none;
		border: none;
		border-bottom: 1px solid var(--ui);
		padding: 0.45rem var(--space-3);
		cursor: pointer;
		text-align: left;
	}
	.agent-row:hover {
		background: var(--bg-3);
	}
	.agent-row.selected {
		border-left: 2px solid var(--primary);
		background: var(--bg-3);
	}
	.agent-row i {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		flex: none;
	}
	.agent-name {
		flex: 1;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--tx);
	}
	.agent-status {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-3);
		text-transform: uppercase;
	}
	.hint {
		padding: var(--space-3);
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--tx-3);
		line-height: 1.5;
	}
	.sel-desc {
		margin: 0 0 var(--space-2);
		font-size: 0.75rem;
		color: var(--tx-2);
		line-height: 1.5;
	}
	.dep {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-3);
		margin-bottom: var(--space-2);
	}
	.asset-list {
		list-style: none;
		margin: 0.2rem 0 var(--space-2);
		padding: 0;
	}
	.asset-list li {
		font-size: 0.72rem;
	}
	.asset-open {
		display: block;
		width: 100%;
		background: none;
		border: none;
		padding: 0.15rem 0;
		cursor: pointer;
		text-align: left;
		font-size: inherit;
	}
	.asset-open:hover strong {
		text-decoration: underline;
	}
	.asset-list strong {
		color: var(--primary);
		font-weight: 500;
	}
	.asset-list span {
		color: var(--tx-3);
		font-size: 0.65rem;
	}
	.log {
		list-style: none;
		margin: 0.2rem 0 0;
		padding: 0;
		max-height: 10rem;
		overflow-y: auto;
	}
	.log li {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-2);
		padding: 0.12rem 0;
		line-height: 1.4;
	}
	.log .at {
		color: var(--tx-3);
	}
</style>
