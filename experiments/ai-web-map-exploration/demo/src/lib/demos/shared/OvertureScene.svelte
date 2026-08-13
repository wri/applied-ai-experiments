<script lang="ts">
	import type { FilterSpecification } from 'maplibre-gl';
	import GeoJSONSource from '$lib/map/GeoJSONSource.svelte';
	import HoverPopup from '$lib/map/HoverPopup.svelte';
	import MapLayer from '$lib/map/MapLayer.svelte';
	import { loadData } from '$lib/data/load';
	import {
		CAN_THO_HOVER_LAYERS,
		floodColorExpression,
		landuseColorExpression,
		PLACE_COLOR,
		WATER_COLOR,
		type InteractiveLayerId
	} from './canTho';

	/**
	 * The shared Can Tho scene. Real Overture layers (land use, buildings, water
	 * accents) render straight from the style-level PMTiles vector sources —
	 * scene-added, so they sweep on demo switch while the sources stay. The
	 * flood-risk bands are a clearly-modelled GeoJSON overlay; places come from
	 * the committed GeoParquet extract (place tiles only exist at z14).
	 */
	interface Props {
		/** reactive per-layer filters, keyed by interactive layer id */
		filters?: Partial<Record<InteractiveLayerId, FilterSpecification | null>>;
		/** reactive per-layer paint overrides */
		paints?: Partial<Record<InteractiveLayerId, Record<string, unknown>>>;
		show?: {
			landuse?: boolean;
			buildings?: boolean;
			water?: boolean;
			flood?: boolean;
			places?: boolean;
		};
		/** hover tooltip with feature attributes (places > flood > land use) */
		hoverAttributes?: boolean;
	}

	let { filters = {}, paints = {}, show = {}, hoverAttributes = true }: Props = $props();

	const visible = $derived({
		landuse: show.landuse ?? true,
		buildings: show.buildings ?? true,
		water: show.water ?? true,
		flood: show.flood ?? true,
		places: show.places ?? true
	});

	let flood = $state.raw<GeoJSON.FeatureCollection | null>(null);
	let places = $state.raw<GeoJSON.FeatureCollection | null>(null);

	$effect(() => {
		loadData('can-tho-flood.geojson').then((d) => (flood = d));
		loadData('overture/can-tho-places.geojson').then((d) => (places = d));
	});
</script>

{#if visible.landuse}
	<MapLayer
		spec={{
			id: 'landuse-fill',
			type: 'fill',
			source: 'overture-base',
			'source-layer': 'land_use',
			minzoom: 6,
			paint: {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				'fill-color': landuseColorExpression() as any,
				'fill-opacity': 0.45
			}
		}}
		filter={filters['landuse-fill']}
		paint={paints['landuse-fill']}
	/>
	<MapLayer
		spec={{
			id: 'landuse-outline',
			type: 'line',
			source: 'overture-base',
			'source-layer': 'land_use',
			minzoom: 11,
			paint: { 'line-color': '#78716c', 'line-width': 0.4, 'line-opacity': 0.4 }
		}}
		filter={filters['landuse-outline']}
		paint={paints['landuse-outline']}
	/>
{/if}

{#if visible.buildings}
	<MapLayer
		spec={{
			id: 'buildings-fill',
			type: 'fill',
			source: 'overture-buildings',
			'source-layer': 'building',
			minzoom: 13,
			paint: { 'fill-color': '#8a8378', 'fill-opacity': 0.35 }
		}}
		filter={filters['buildings-fill']}
		paint={paints['buildings-fill']}
	/>
{/if}

{#if visible.water}
	<MapLayer
		spec={{
			id: 'water-fill',
			type: 'fill',
			source: 'overture-base',
			'source-layer': 'water',
			filter: ['==', ['geometry-type'], 'Polygon'],
			paint: { 'fill-color': WATER_COLOR, 'fill-opacity': 0.22 }
		}}
		paint={paints['water-fill']}
	/>
	<MapLayer
		spec={{
			id: 'water-line',
			type: 'line',
			source: 'overture-base',
			'source-layer': 'water',
			filter: ['==', ['geometry-type'], 'LineString'],
			paint: { 'line-color': WATER_COLOR, 'line-width': 1.2, 'line-opacity': 0.5 }
		}}
		paint={paints['water-line']}
	/>
{/if}

{#if flood && visible.flood}
	<GeoJSONSource id="can-tho-flood" data={flood} promoteId="id">
		<MapLayer
			spec={{
				id: 'flood-zones',
				type: 'fill',
				source: 'can-tho-flood',
				paint: {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					'fill-color': floodColorExpression() as any,
					'fill-opacity': 0.3
				}
			}}
			filter={filters['flood-zones']}
			paint={paints['flood-zones']}
		/>
		<MapLayer
			spec={{
				id: 'flood-zones-outline',
				type: 'line',
				source: 'can-tho-flood',
				paint: {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					'line-color': floodColorExpression() as any,
					'line-width': 1,
					'line-opacity': 0.6,
					'line-dasharray': [2, 2]
				}
			}}
			filter={filters['flood-zones-outline']}
		/>
	</GeoJSONSource>
{/if}

{#if places && visible.places}
	<GeoJSONSource id="can-tho-places" data={places} promoteId="id">
		<MapLayer
			spec={{
				id: 'places-dots',
				type: 'circle',
				source: 'can-tho-places',
				minzoom: 10,
				paint: {
					'circle-color': PLACE_COLOR,
					'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 14, 3.5],
					'circle-opacity': 0.75
				}
			}}
			filter={filters['places-dots']}
			paint={paints['places-dots']}
		/>
	</GeoJSONSource>
{/if}

{#if hoverAttributes}
	<HoverPopup layers={CAN_THO_HOVER_LAYERS} />
{/if}
