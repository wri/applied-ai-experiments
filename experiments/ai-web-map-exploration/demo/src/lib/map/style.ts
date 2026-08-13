import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';
import type maplibregl from 'maplibre-gl';
import { OVERTURE_ATTRIBUTION, pmtilesUrl } from '$lib/data/overture';
import type { Theme } from '$lib/state/theme.svelte';

export type BasemapId = 'streets' | 'satellite';

export const SATELLITE_LAYER_ID = 'basemap-satellite';

/**
 * Every vector basemap layer (visibility-flipped against the satellite raster).
 * Order matters: it is the style's layer order.
 */
export const VECTOR_BASEMAP_LAYER_IDS = [
	'basemap-bg',
	'basemap-land',
	'basemap-landcover',
	'basemap-landuse',
	'basemap-water',
	'basemap-water-line',
	'basemap-boundaries',
	'basemap-roads-minor',
	'basemap-roads-major',
	'basemap-buildings',
	'basemap-locality-labels'
] as const;

/** Curated subset for context snapshots — rich enough to inform, small enough not to drown prompts. */
export const BASEMAP_LAYER_IDS = [
	'basemap-landuse',
	'basemap-water',
	'basemap-roads-major',
	'basemap-buildings',
	'basemap-satellite'
] as const;

/**
 * Basemap palette aligned to the design-token families (warm neutrals; no amber
 * so `--primary` stays reserved for actions and the flood ramp).
 */
interface BasemapPalette {
	bg: string;
	land: string;
	landcover: string;
	landuse: string;
	landuseGreen: string;
	water: string;
	waterLine: string;
	roadMinor: string;
	roadMajor: string;
	building: string;
	boundary: string;
	labelText: string;
	labelHalo: string;
}

const PALETTES: Record<'dark' | 'light', BasemapPalette> = {
	dark: {
		bg: '#171512',
		land: '#1c1a18',
		landcover: '#20231d',
		landuse: '#242019',
		landuseGreen: '#212619',
		water: '#1d2b36',
		waterLine: '#2b4152',
		roadMinor: '#36322e',
		roadMajor: '#4a443d',
		building: '#292522',
		boundary: '#534d47',
		labelText: '#a8a29e',
		labelHalo: '#1c1a18'
	},
	light: {
		bg: '#f2efe9',
		land: '#faf8f6',
		landcover: '#e9ecdf',
		landuse: '#f0e9dd',
		landuseGreen: '#e4ecd8',
		water: '#c7dbe6',
		waterLine: '#a3c2d4',
		roadMinor: '#e4dfd7',
		roadMajor: '#d3ccc1',
		building: '#e8e4de',
		boundary: '#b8b4ae',
		labelText: '#5c5a58',
		labelHalo: '#faf8f6'
	}
};

function paletteFor(theme: Theme): BasemapPalette {
	// High-contrast UI theme keeps the dark map — panel chrome carries the contrast.
	return theme === 'light' ? PALETTES.light : PALETTES.dark;
}

/**
 * (layerId, paintProperty, value-from-palette) — single source of truth used
 * both to build the initial style and to restyle in place on theme change
 * (never setStyle: that would wipe scene-added demo layers).
 */
const PAINT_TABLE: [string, string, (p: BasemapPalette) => unknown][] = [
	['basemap-bg', 'background-color', (p) => p.bg],
	['basemap-land', 'fill-color', (p) => p.land],
	['basemap-landcover', 'fill-color', (p) => p.landcover],
	[
		'basemap-landuse',
		'fill-color',
		(p) => [
			'match',
			['get', 'subtype'],
			['agriculture', 'park', 'recreation', 'golf', 'campground', 'horticulture', 'winter_sports'],
			p.landuseGreen,
			p.landuse
		]
	],
	['basemap-water', 'fill-color', (p) => p.water],
	['basemap-water-line', 'line-color', (p) => p.waterLine],
	['basemap-boundaries', 'line-color', (p) => p.boundary],
	['basemap-roads-minor', 'line-color', (p) => p.roadMinor],
	['basemap-roads-major', 'line-color', (p) => p.roadMajor],
	['basemap-buildings', 'fill-color', (p) => p.building],
	['basemap-locality-labels', 'text-color', (p) => p.labelText],
	['basemap-locality-labels', 'text-halo-color', (p) => p.labelHalo]
];

function paintFor(layerId: string, palette: BasemapPalette): Record<string, unknown> {
	const paint: Record<string, unknown> = {};
	for (const [id, prop, value] of PAINT_TABLE) {
		if (id === layerId) paint[prop] = value(palette);
	}
	return paint;
}

/** Restyle the basemap in place when the app theme changes. */
export function applyBasemapTheme(map: maplibregl.Map, theme: Theme): void {
	const palette = paletteFor(theme);
	for (const [layerId, prop, value] of PAINT_TABLE) {
		if (map.getLayer(layerId)) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			map.setPaintProperty(layerId, prop as any, value(palette));
		}
	}
}

/**
 * Vector basemap built from Overture Maps hosted PMTiles (per-theme archives on
 * S3, fetched with HTTP range requests — no tile server, no key), plus the Esri
 * World Imagery raster kept for the 'satellite' basemap. Overture source-layer
 * ids and zoom ranges: land/water/land_cover z0+, land_use z6+, segment z4+,
 * building z6+ (rendered from z12), division z0-12.
 */
export function createBaseStyle(release: string, theme: Theme): StyleSpecification {
	const p = paletteFor(theme);

	const layers: LayerSpecification[] = [
		{ id: 'basemap-bg', type: 'background', paint: { 'background-color': p.bg } },
		{
			id: 'basemap-land',
			type: 'fill',
			source: 'overture-base',
			'source-layer': 'land',
			filter: ['==', ['geometry-type'], 'Polygon']
		},
		{
			id: 'basemap-landcover',
			type: 'fill',
			source: 'overture-base',
			'source-layer': 'land_cover',
			maxzoom: 10,
			paint: { 'fill-opacity': 0.5 }
		},
		{
			id: 'basemap-landuse',
			type: 'fill',
			source: 'overture-base',
			'source-layer': 'land_use',
			minzoom: 6,
			filter: ['==', ['geometry-type'], 'Polygon'],
			paint: { 'fill-opacity': 0.6 }
		},
		{
			id: 'basemap-water',
			type: 'fill',
			source: 'overture-base',
			'source-layer': 'water',
			filter: ['==', ['geometry-type'], 'Polygon']
		},
		{
			id: 'basemap-water-line',
			type: 'line',
			source: 'overture-base',
			'source-layer': 'water',
			filter: ['==', ['geometry-type'], 'LineString'],
			paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 2] }
		},
		{
			id: 'basemap-boundaries',
			type: 'line',
			source: 'overture-divisions',
			'source-layer': 'division_boundary',
			paint: { 'line-width': 1, 'line-dasharray': [3, 2], 'line-opacity': 0.6 }
		},
		{
			id: 'basemap-roads-minor',
			type: 'line',
			source: 'overture-transportation',
			'source-layer': 'segment',
			minzoom: 10,
			filter: [
				'all',
				['==', ['get', 'subtype'], 'road'],
				[
					'!',
					['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]]
				]
			],
			paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.4, 16, 3] }
		},
		{
			id: 'basemap-roads-major',
			type: 'line',
			source: 'overture-transportation',
			'source-layer': 'segment',
			minzoom: 5,
			filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]],
			paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 12, 2, 16, 5] }
		},
		{
			id: 'basemap-buildings',
			type: 'fill',
			source: 'overture-buildings',
			'source-layer': 'building',
			minzoom: 12,
			paint: { 'fill-opacity': 0.7 }
		},
		{
			id: 'basemap-locality-labels',
			type: 'symbol',
			source: 'overture-divisions',
			'source-layer': 'division',
			maxzoom: 12,
			filter: ['in', ['get', 'subtype'], ['literal', ['locality', 'county', 'region']]],
			layout: {
				'text-field': ['coalesce', ['get', '@name'], ['get', 'names']],
				'text-font': ['Noto Sans Regular'],
				'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 10, 13]
			},
			paint: { 'text-halo-width': 1.2 }
		},
		{
			id: SATELLITE_LAYER_ID,
			type: 'raster',
			source: 'satellite',
			layout: { visibility: 'none' }
		}
	];

	// Merge palette-driven paint into the skeletons above.
	for (const layer of layers) {
		const paint = paintFor(layer.id, p);
		if (Object.keys(paint).length) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(layer as any).paint = { ...(layer as any).paint, ...paint };
		}
	}

	return {
		version: 8,
		// Noto Sans covers the Vietnamese diacritics Overture names need.
		glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
		sources: {
			'overture-base': {
				type: 'vector',
				url: pmtilesUrl(release, 'base'),
				attribution: OVERTURE_ATTRIBUTION
			},
			'overture-transportation': {
				type: 'vector',
				url: pmtilesUrl(release, 'transportation'),
				attribution: OVERTURE_ATTRIBUTION
			},
			'overture-buildings': {
				type: 'vector',
				url: pmtilesUrl(release, 'buildings'),
				attribution: OVERTURE_ATTRIBUTION
			},
			'overture-divisions': {
				type: 'vector',
				url: pmtilesUrl(release, 'divisions'),
				attribution: OVERTURE_ATTRIBUTION
			},
			satellite: {
				type: 'raster',
				tiles: [
					'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
				],
				tileSize: 256,
				maxzoom: 19,
				attribution: '© Esri, Maxar, Earthstar Geographics'
			}
		},
		layers
	};
}
