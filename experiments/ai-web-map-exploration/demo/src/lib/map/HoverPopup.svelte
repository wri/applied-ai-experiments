<script lang="ts">
	import maplibregl from 'maplibre-gl';
	import { mapStore } from './MapStore.svelte';
	import type { HoverLayerConfig } from './hover';

	/**
	 * Declarative hover-attributes popup. Mount it in a demo with a layer
	 * config; it shows a non-interactive tooltip with formatted feature
	 * attributes when the cursor is over an eligible feature. Config order is
	 * the priority order — the first config with a hit wins, so list point/dot
	 * layers before fills.
	 */
	interface Props {
		layers: HoverLayerConfig[];
		/** suppress the popup (e.g. while a demo-owned drag interaction runs) */
		disabled?: boolean;
	}

	let { layers, disabled = false }: Props = $props();

	interface TipRow {
		label: string;
		value: string;
	}
	let tip = $state<{ title: string; rows: TipRow[] } | null>(null);
	let tipEl = $state<HTMLDivElement | undefined>();

	let popup: maplibregl.Popup | null = null;
	let shown = false;
	let cursorSet = false;
	let lastKey = '';

	function hide() {
		if (shown) {
			popup?.remove();
			shown = false;
		}
		const m = mapStore.map;
		if (cursorSet && m) {
			m.getCanvas().style.cursor = '';
			cursorSet = false;
		}
		tip = null;
		lastKey = '';
	}

	$effect(() => {
		if (disabled) hide();
	});

	$effect(() => {
		let disposed = false;
		let raf = 0;
		let pending: maplibregl.MapMouseEvent | null = null;
		let detach: (() => void) | null = null;

		mapStore.whenReady().then((map) => {
			if (disposed) return;
			popup = new maplibregl.Popup({
				closeButton: false,
				closeOnClick: false,
				focusAfterOpen: false,
				className: 'hover-popup',
				offset: 12,
				maxWidth: '280px'
			});

			const process = (e: maplibregl.MapMouseEvent) => {
				if (disabled) return hide();
				const existing = layers.filter((l) => map.getLayer(l.layerId));
				if (!existing.length) return hide();
				const pad = Math.max(...existing.map((l) => l.hitPad ?? 4));
				const feats = map.queryRenderedFeatures(
					[
						[e.point.x - pad, e.point.y - pad],
						[e.point.x + pad, e.point.y + pad]
					],
					{ layers: existing.map((l) => l.layerId) }
				);
				let cfg: HoverLayerConfig | null = null;
				let hit: maplibregl.MapGeoJSONFeature | null = null;
				for (const l of existing) {
					const f = feats.find((f) => f.layer.id === l.layerId);
					if (f) {
						cfg = l;
						hit = f;
						break;
					}
				}
				if (!cfg || !hit) return hide();

				const props = hit.properties ?? {};
				const key = `${cfg.layerId}|${hit.id ?? props.id ?? props.name ?? JSON.stringify(props)}`;
				if (key !== lastKey) {
					lastKey = key;
					const title =
						typeof cfg.title === 'function' ? cfg.title(props) : (cfg.title ?? cfg.layerId);
					tip = {
						title,
						rows: cfg.fields
							.filter((f) => props[f.prop] !== undefined && props[f.prop] !== null && props[f.prop] !== '')
							.map((f) => ({
								label: f.label,
								value: f.format ? f.format(props[f.prop], props) : String(props[f.prop])
							}))
					};
				}
				map.getCanvas().style.cursor = 'pointer';
				cursorSet = true;
				popup!.setLngLat(e.lngLat);
				if (!shown && tipEl) {
					popup!.setDOMContent(tipEl);
					popup!.addTo(map);
					shown = true;
				}
			};

			const onMove = (e: maplibregl.MapMouseEvent) => {
				pending = e;
				if (raf) return;
				raf = requestAnimationFrame(() => {
					raf = 0;
					if (pending && !disposed) process(pending);
				});
			};
			const onOut = () => hide();

			map.on('mousemove', onMove);
			map.on('mouseout', onOut);
			detach = () => {
				map.off('mousemove', onMove);
				map.off('mouseout', onOut);
			};
		});

		return () => {
			disposed = true;
			if (raf) cancelAnimationFrame(raf);
			detach?.();
			hide();
			popup = null;
		};
	});
</script>

<!-- Hidden host; the popup reparents the tip on first show. -->
<div style="display: none">
	<div class="tip" bind:this={tipEl}>
		{#if tip}
			<div class="tip-title">{tip.title}</div>
			{#each tip.rows as r (r.label)}
				<div class="tip-row">
					<span class="tl">{r.label}</span>
					<span class="tv">{r.value}</span>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.tip {
		min-width: 8rem;
	}
	.tip-title {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--tx);
		margin-bottom: 0.25rem;
	}
	.tip-row {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
		padding: 0.08rem 0;
	}
	.tl {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--tx-3);
	}
	.tv {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--tx);
		text-align: right;
	}
</style>
