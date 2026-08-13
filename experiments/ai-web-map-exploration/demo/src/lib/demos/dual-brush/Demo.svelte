<script lang="ts">
	import { loadData } from '$lib/data/load';
	import GeoJSONSource from '$lib/map/GeoJSONSource.svelte';
	import HoverPopup from '$lib/map/HoverPopup.svelte';
	import { humanize } from '$lib/map/hover';
	import MapLayer from '$lib/map/MapLayer.svelte';
	import { mapStore } from '$lib/map/MapStore.svelte';
	import OverlayPanel from '$lib/shell/OverlayPanel.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { Button } from '@wri-datalab/ui';
	import Panel from '$lib/ui/Panel.svelte';
	import Scatterplot from './Scatterplot.svelte';
	import { CATEGORY_COLORS, categoryColorExpression, toPoints, type EmbPoint } from './points';
	import type { FilterSpecification } from 'maplibre-gl';

	let fc = $state.raw<GeoJSON.FeatureCollection | null>(null);
	let points = $state.raw<EmbPoint[]>([]);

	$effect(() => {
		loadData('points-embeddings.geojson').then((d) => {
			fc = d;
			points = toPoints(d);
		});
	});

	// --- selection state (shared across both spaces) ---
	let brushIds = $state<string[] | null>(null); // from scatter brush
	let mapIds = $state<string[] | null>(null); // from map box-select
	let viewportLink = $state(true);

	const selected = $derived(new Set<string>([...(brushIds ?? []), ...(mapIds ?? [])]));

	// map → scatter: which points are inside the viewport
	const inView = $derived.by<Set<string> | null>(() => {
		if (!viewportLink) return null;
		const b = mapStore.viewport.bounds;
		if (!b) return null;
		const [[w, s], [e, n]] = b;
		return new Set(
			points.filter((p) => p.lon >= w && p.lon <= e && p.lat >= s && p.lat <= n).map((p) => p.id)
		);
	});

	const highlightFilter = $derived.by<FilterSpecification>(() => {
		const ids = [...selected];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return ['in', ['get', 'id'], ['literal', ids.length ? ids : ['__none__']]] as any;
	});

	// histogram of selection by category
	const histogram = $derived.by(() => {
		const src = selected.size ? points.filter((p) => selected.has(p.id)) : [];
		const counts = new Map<string, number>();
		for (const p of src) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
		const max = Math.max(1, ...counts.values());
		return Object.keys(CATEGORY_COLORS).map((cat) => ({
			cat,
			count: counts.get(cat) ?? 0,
			frac: (counts.get(cat) ?? 0) / max
		}));
	});

	// --- map box-select mode ---
	let selecting = $state(false);
	let boxStart = $state<{ x: number; y: number } | null>(null);
	let boxEnd = $state<{ x: number; y: number } | null>(null);

	const box = $derived.by(() => {
		if (!boxStart || !boxEnd) return null;
		return {
			x: Math.min(boxStart.x, boxEnd.x),
			y: Math.min(boxStart.y, boxEnd.y),
			w: Math.abs(boxStart.x - boxEnd.x),
			h: Math.abs(boxStart.y - boxEnd.y)
		};
	});

	function enterSelectMode() {
		selecting = true;
		const map = mapStore.map;
		if (!map) return;
		map.dragPan.disable();
		map.getCanvas().style.cursor = 'crosshair';
	}

	function exitSelectMode() {
		selecting = false;
		boxStart = null;
		boxEnd = null;
		const map = mapStore.map;
		if (!map) return;
		map.dragPan.enable();
		map.getCanvas().style.cursor = '';
	}

	$effect(() => {
		let disposed = false;
		let cleanup: (() => void) | null = null;
		mapStore.whenReady().then((map) => {
			if (disposed) return;
			const canvas = map.getCanvasContainer();
			const onDown = (e: MouseEvent) => {
				if (!selecting) return;
				const r = canvas.getBoundingClientRect();
				boxStart = { x: e.clientX - r.left, y: e.clientY - r.top };
				boxEnd = boxStart;
				e.preventDefault();
			};
			const onMove = (e: MouseEvent) => {
				if (!selecting || !boxStart) return;
				const r = canvas.getBoundingClientRect();
				boxEnd = { x: e.clientX - r.left, y: e.clientY - r.top };
			};
			const onUp = () => {
				if (!selecting || !box) return;
				const feats = map.queryRenderedFeatures(
					[
						[box.x, box.y],
						[box.x + box.w, box.y + box.h]
					],
					{ layers: ['emb-points'] }
				);
				mapIds = feats.map((f) => String(f.properties?.id)).filter((s) => s && s !== 'undefined');
				exitSelectMode();
			};
			canvas.addEventListener('mousedown', onDown);
			canvas.addEventListener('mousemove', onMove);
			canvas.addEventListener('mouseup', onUp);
			cleanup = () => {
				canvas.removeEventListener('mousedown', onDown);
				canvas.removeEventListener('mousemove', onMove);
				canvas.removeEventListener('mouseup', onUp);
			};
		});
		return () => {
			disposed = true;
			cleanup?.();
			exitSelectMode();
		};
	});

	function clearAll() {
		brushIds = null;
		mapIds = null;
	}
</script>

{#if fc}
	<GeoJSONSource id="emb" data={fc}>
		<MapLayer
			spec={{
				id: 'emb-points',
				type: 'circle',
				source: 'emb',
				paint: {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					'circle-color': categoryColorExpression() as any,
					'circle-radius': 4,
					'circle-opacity': 0.75,
					'circle-stroke-width': 0.5,
					'circle-stroke-color': '#1c1a18'
				}
			}}
		/>
		<MapLayer
			spec={{
				id: 'emb-highlight',
				type: 'circle',
				source: 'emb',
				paint: {
					'circle-color': 'transparent',
					'circle-radius': 8,
					'circle-stroke-width': 2.5,
					'circle-stroke-color': '#eab308'
				}
			}}
			filter={highlightFilter}
		/>
	</GeoJSONSource>
	<HoverPopup
		disabled={selecting}
		layers={[
			{
				layerId: 'emb-points',
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

{#if box && selecting}
	<div class="select-box" style:left="{box.x}px" style:top="{box.y}px" style:width="{box.w}px" style:height="{box.h}px"></div>
{/if}

<OverlayPanel side="right" width="23.5rem">
	<Panel title="Embedding space" padded={false}>
		{#snippet actions()}
			{#if selected.size}<Badge tone="primary">{selected.size} selected</Badge>{/if}
		{/snippet}
		<div class="pad">
			<Scatterplot {points} {selected} {inView} onbrush={(ids) => (brushIds = ids)} />
			<div class="cats">
				{#each Object.entries(CATEGORY_COLORS) as [cat, color] (cat)}
					<span class="cat"><i style:background={color}></i>{cat.replaceAll('_', ' ')}</span>
				{/each}
			</div>
		</div>
	</Panel>

	<Panel title="Linkage">
		<p class="lead">
			500 real Overture places in two spaces: <strong>geographic</strong> (map) and
			<strong>embedding</strong> (scatterplot — the 2-D projection is modelled; the places and
			their categories are real). Brush either side to select in the other.
		</p>
		<div class="controls">
			<Button
				variant={selecting ? 'primary' : 'secondary'}
				onclick={() => (selecting ? exitSelectMode() : enterSelectMode())}
			>
				{selecting ? 'drag a box on the map…' : 'box-select on map'}
			</Button>
			<Button onclick={clearAll} disabled={!selected.size}>clear selection</Button>
		</div>
		<label class="vlink">
			<input type="checkbox" bind:checked={viewportLink} />
			<span>viewport dims out-of-view points in the scatterplot (map → chart, ambient)</span>
		</label>
		{#if selected.size}
			<div class="label hist-label">selection by category</div>
			<div class="hist">
				{#each histogram as h (h.cat)}
					<div class="hist-row">
						<span class="hist-cat">{h.cat.replaceAll('_', ' ')}</span>
						<div class="hist-track">
							<div
								class="hist-bar"
								style:width="{h.frac * 100}%"
								style:background={CATEGORY_COLORS[h.cat]}
							></div>
						</div>
						<span class="hist-n">{h.count}</span>
					</div>
				{/each}
			</div>
		{/if}
	</Panel>
</OverlayPanel>

<style>
	.pad {
		padding: var(--space-3);
	}
	.cats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: var(--space-2);
	}
	.cat {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-2);
	}
	.cat i {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		display: inline-block;
	}
	.lead {
		margin: 0 0 var(--space-3);
		font-size: 0.78rem;
		line-height: 1.55;
		color: var(--tx-2);
	}
	.lead strong {
		color: var(--tx);
	}
	.controls {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.vlink {
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
		margin-top: var(--space-3);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--tx-2);
		line-height: 1.45;
		cursor: pointer;
	}
	.vlink input {
		accent-color: var(--primary);
		margin-top: 0.1rem;
	}
	.hist-label {
		margin: var(--space-4) 0 var(--space-2);
	}
	.hist {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.hist-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.hist-cat {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-2);
		width: 5.5rem;
		flex: none;
	}
	.hist-track {
		flex: 1;
		height: 8px;
		background: var(--bg);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.hist-bar {
		height: 100%;
	}
	.hist-n {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx);
		width: 2rem;
		text-align: right;
	}
	.select-box {
		position: absolute;
		z-index: 30;
		border: 1px dashed var(--primary);
		background: color-mix(in srgb, var(--primary) 12%, transparent);
		pointer-events: none;
	}
</style>
