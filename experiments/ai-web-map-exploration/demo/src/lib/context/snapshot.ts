/**
 * Context snapshot service — the shared spine for AI features. "What does the
 * app know right now?" collected into one typed object: fed to prompts
 * (serializeForPrompt), rendered raw by the context-telemetry demo.
 */

import type maplibregl from 'maplibre-gl';
import type { MapStore } from '$lib/map/MapStore.svelte';
import { themeStore } from '$lib/state/theme.svelte';
import { storageGet } from '$lib/state/storage';
import { BASEMAP_LAYER_IDS } from '$lib/map/style';
import type {
	ContextSnapshot,
	EnvironmentContext,
	FeatureSummary,
	LayerContext,
	ViewportContext
} from './types';

export interface SnapshotOptions {
	activeDemo?: string;
	llmMode?: 'mock' | 'live';
	/** screen point to sample features at (e.g. right-click location) */
	atPoint?: { x: number; y: number };
	/** cached place name from reverse geocoding, if the caller has one */
	placeName?: string | null;
}

function buildViewport(map: maplibregl.Map): ViewportContext {
	const c = map.getCenter();
	const zoom = map.getZoom();
	const b = map.getBounds();
	const metersPerPixel =
		(78271.484 / 2 ** zoom) * Math.cos((c.lat * Math.PI) / 180);
	return {
		center: [Number(c.lng.toFixed(5)), Number(c.lat.toFixed(5))],
		zoom: Number(zoom.toFixed(2)),
		bearing: Number(map.getBearing().toFixed(1)),
		pitch: Number(map.getPitch().toFixed(1)),
		bounds: [
			[Number(b.getWest().toFixed(5)), Number(b.getSouth().toFixed(5))],
			[Number(b.getEast().toFixed(5)), Number(b.getNorth().toFixed(5))]
		],
		metersPerPixel: Number(metersPerPixel.toFixed(1)),
		viewWidthKm: Number(((metersPerPixel * map.getContainer().clientWidth) / 1000).toFixed(1))
	};
}

function buildLayers(map: maplibregl.Map, sceneLayerIds: string[]): LayerContext[] {
	const ids = [...BASEMAP_LAYER_IDS, ...sceneLayerIds];
	return ids
		.map((id) => {
			const layer = map.getLayer(id);
			if (!layer) return null;
			const visible = map.getLayoutProperty(id, 'visibility') !== 'none';
			let featureCountInView = 0;
			let attributes: Record<string, unknown> | null = null;
			if (layer.type !== 'raster') {
				try {
					const feats = map.queryRenderedFeatures(undefined, { layers: [id] });
					featureCountInView = feats.length;
					if (feats.length) attributes = { ...feats[0].properties };
				} catch {
					// layer not ready yet
				}
			}
			return {
				id,
				type: String(layer.type),
				source: 'source' in layer ? String(layer.source) : '',
				visible,
				featureCountInView,
				attributes
			};
		})
		.filter((l): l is LayerContext => l !== null);
}

function buildEnvironment(): EnvironmentContext {
	return {
		userAgent: navigator.userAgent,
		language: navigator.language,
		languages: [...navigator.languages],
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		viewportPx: { width: window.innerWidth, height: window.innerHeight },
		devicePixelRatio: window.devicePixelRatio,
		prefersColorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches
			? 'dark'
			: 'light',
		prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
		online: navigator.onLine,
		touch: navigator.maxTouchPoints > 0
	};
}

function timeOfDay(h: number): 'morning' | 'afternoon' | 'evening' | 'night' {
	if (h < 6) return 'night';
	if (h < 12) return 'morning';
	if (h < 18) return 'afternoon';
	if (h < 22) return 'evening';
	return 'night';
}

function scaleLabel(viewWidthKm: number): string {
	if (viewWidthKm > 2000) return 'continental';
	if (viewWidthKm > 400) return 'regional';
	if (viewWidthKm > 50) return 'landscape';
	if (viewWidthKm > 8) return 'city';
	if (viewWidthKm > 1.5) return 'neighborhood';
	return 'site';
}

export function buildContextSnapshot(
	mapStore: MapStore,
	opts: SnapshotOptions = {}
): ContextSnapshot | null {
	const map = mapStore.map;
	if (!map || !mapStore.loaded) return null;

	const viewport = buildViewport(map);

	let featuresAtPoint: FeatureSummary[] | null = null;
	if (opts.atPoint) {
		featuresAtPoint = map
			.queryRenderedFeatures([opts.atPoint.x, opts.atPoint.y], {
				layers: mapStore.scene.layerIds.filter((id) => map.getLayer(id))
			})
			.slice(0, 5)
			.map((f) => ({ layerId: f.layer.id, properties: { ...f.properties } }));
	}

	const now = new Date();
	return {
		capturedAt: now.toISOString(),
		viewport,
		layers: buildLayers(map, mapStore.scene.layerIds),
		featuresAtPoint,
		environment: buildEnvironment(),
		session: {
			activeDemo: opts.activeDemo ?? '',
			theme: themeStore.current,
			basemap: mapStore.basemap,
			llmMode: opts.llmMode ?? 'mock',
			lastVisit: storageGet<string | null>('lastVisit:v1', null),
			localTime: now.toLocaleString(),
			timeOfDay: timeOfDay(now.getHours())
		},
		derived: {
			placeName: opts.placeName ?? null,
			approxScale: scaleLabel(viewport.viewWidthKm)
		}
	};
}

/** Rough token estimate (chars / 4). */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

export type SnapshotSection = 'viewport' | 'layers' | 'features' | 'environment' | 'session';

/**
 * Compact plain-text serialization for prompts. Sections are opt-in so demos
 * can spend their token budget deliberately.
 */
export function serializeForPrompt(
	snapshot: ContextSnapshot,
	sections: SnapshotSection[] = ['viewport', 'layers', 'session']
): string {
	const parts: string[] = [];
	if (sections.includes('viewport')) {
		const v = snapshot.viewport;
		parts.push(
			`VIEWPORT: center ${v.center[1]},${v.center[0]} (lat,lon); zoom ${v.zoom}; ` +
				`view ~${v.viewWidthKm} km wide (${snapshot.derived.approxScale} scale)` +
				(snapshot.derived.placeName ? `; place: ${snapshot.derived.placeName}` : '')
		);
	}
	if (sections.includes('layers')) {
		const lines = snapshot.layers.map(
			(l) =>
				`- ${l.id} (${l.type}${l.visible ? '' : ', hidden'})` +
				(l.featureCountInView ? `: ${l.featureCountInView} features in view` : '') +
				(l.attributes ? `; attrs: ${Object.keys(l.attributes).join(', ')}` : '')
		);
		parts.push(`LAYERS:\n${lines.join('\n')}`);
	}
	if (sections.includes('features') && snapshot.featuresAtPoint?.length) {
		parts.push(
			`FEATURES AT POINT:\n${snapshot.featuresAtPoint
				.map((f) => `- [${f.layerId}] ${JSON.stringify(f.properties)}`)
				.join('\n')}`
		);
	}
	if (sections.includes('environment')) {
		const e = snapshot.environment;
		parts.push(
			`ENVIRONMENT: ${e.language}; tz ${e.timezone}; ${e.viewportPx.width}x${e.viewportPx.height}px; ` +
				`${e.touch ? 'touch' : 'pointer'} device`
		);
	}
	if (sections.includes('session')) {
		const s = snapshot.session;
		parts.push(
			`SESSION: demo "${s.activeDemo}"; basemap ${s.basemap}; local time ${s.localTime} (${s.timeOfDay})` +
				(s.lastVisit ? `; last visit ${s.lastVisit}` : '; first visit')
		);
	}
	return parts.join('\n\n');
}
