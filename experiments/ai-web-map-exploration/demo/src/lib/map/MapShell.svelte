<script lang="ts" module>
	import maplibregl from 'maplibre-gl';
	import { Protocol } from 'pmtiles';

	// Once per app: lets vector sources use pmtiles:// URLs (HTTP range requests
	// straight into Overture's hosted archives — no tile server).
	maplibregl.addProtocol('pmtiles', new Protocol().tile);
</script>

<script lang="ts">
	import { browser } from '$app/environment';
	import { untrack } from 'svelte';
	import { resolveRelease } from '$lib/data/overture';
	import { themeStore } from '$lib/state/theme.svelte';
	import { mapStore } from './MapStore.svelte';
	import { applyBasemapTheme, createBaseStyle } from './style';

	let container: HTMLDivElement | undefined = $state();
	let initialized = false;

	$effect(() => {
		if (!browser || !container || initialized) return;
		initialized = true;

		return untrack(() => {
			let cancelled = false;
			let map: maplibregl.Map | null = null;

			// Resolve the current Overture release BEFORE creating the map: the
			// style needs final source URLs, and a later setStyle() would wipe
			// scene-added demo layers. Cached in localStorage → instant after the
			// first load; falls back to the pinned release, never throws.
			resolveRelease().then((release) => {
				if (cancelled || !container) return;

				map = new maplibregl.Map({
					container,
					style: createBaseStyle(release, themeStore.current),
					center: mapStore.viewport.center,
					zoom: mapStore.viewport.zoom,
					attributionControl: { compact: true },
					// Required for the explain-view screenshot pipeline (v5 moved WebGL
					// context options under canvasContextAttributes)
					canvasContextAttributes: { preserveDrawingBuffer: true }
				});

				map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
				map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

				// Unreachable tiles (offline, release rotated away) degrade to console
				// noise — MapLibre still fires `load`, so the app boots regardless.
				map.on('error', (e) => console.warn('[map]', e.error?.message ?? e));

				map.on('load', () => {
					if (!cancelled && map) mapStore.attach(map);
				});
			});

			return () => {
				cancelled = true;
				mapStore.detach();
				map?.remove();
			};
		});
	});

	// Restyle the basemap in place when the app theme changes (never setStyle).
	$effect(() => {
		const theme = themeStore.current;
		if (mapStore.loaded && mapStore.map) applyBasemapTheme(mapStore.map, theme);
	});
</script>

<div
	class="map-container"
	bind:this={container}
	style:visibility={mapStore.visible ? 'visible' : 'hidden'}
></div>

<style>
	.map-container {
		position: absolute;
		inset: 0;
	}
	/* Never display:none — a zero-size canvas corrupts rendering. */
</style>
