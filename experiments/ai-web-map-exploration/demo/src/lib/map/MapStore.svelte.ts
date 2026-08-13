/**
 * Single persistent map instance + scene lifecycle.
 *
 * One MapLibre map is mounted once (MapShell in the root layout) and never
 * destroyed. Demos attach layers/sources/handlers/markers through the `scene`
 * API (directly or via the declarative <GeoJSONSource>/<MapLayer> components);
 * everything registered there is swept by resetScene() when the demo changes.
 *
 * The map instance itself is a plain field — never $state (deep-proxying a
 * MapLibre map breaks it). Only small serializable view state is reactive.
 */

import maplibregl from 'maplibre-gl';
import type {
	FilterSpecification,
	LayerSpecification,
	LngLatBoundsLike,
	MapLayerEventType,
	SourceSpecification
} from 'maplibre-gl';
import { SATELLITE_LAYER_ID, VECTOR_BASEMAP_LAYER_IDS, type BasemapId } from './style';

export interface Viewport {
	center: [number, number];
	zoom: number;
	bearing: number;
	pitch: number;
	bounds: [[number, number], [number, number]] | null;
}

export interface CameraTarget {
	center: [number, number];
	zoom: number;
	pitch?: number;
	bearing?: number;
}

type MapEventName = keyof MapLayerEventType | 'moveend' | 'move' | 'click' | 'contextmenu';

interface SceneHandler {
	type: string;
	layerId?: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	fn: (...args: any[]) => void;
}

/** Imperative, self-registering scene API. Everything added is swept on reset. */
export class Scene {
	private layers = new Set<string>();
	private sources = new Set<string>();
	private handlers: SceneHandler[] = [];
	private markers = new Set<maplibregl.Marker>();
	private popups = new Set<maplibregl.Popup>();

	constructor(private store: MapStore) {}

	get map(): maplibregl.Map {
		const m = this.store.map;
		if (!m) throw new Error('Map not initialized');
		return m;
	}

	hasSource(id: string): boolean {
		return !!this.store.map?.getSource(id);
	}

	hasLayer(id: string): boolean {
		return !!this.store.map?.getLayer(id);
	}

	addSource(id: string, spec: SourceSpecification): void {
		if (this.hasSource(id)) this.removeSource(id);
		this.map.addSource(id, spec);
		this.sources.add(id);
	}

	setData(sourceId: string, data: GeoJSON.GeoJSON): void {
		const src = this.store.map?.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
		src?.setData(data);
	}

	addLayer(spec: LayerSpecification, beforeId?: string): void {
		if (this.hasLayer(spec.id)) this.removeLayer(spec.id);
		this.map.addLayer(spec, beforeId && this.hasLayer(beforeId) ? beforeId : undefined);
		this.layers.add(spec.id);
	}

	removeLayer(id: string): void {
		if (this.hasLayer(id)) this.map.removeLayer(id);
		this.layers.delete(id);
	}

	removeSource(id: string): void {
		// remove any of our layers still using it first
		for (const layerId of [...this.layers]) {
			const layer = this.store.map?.getLayer(layerId);
			if (layer && 'source' in layer && layer.source === id) this.removeLayer(layerId);
		}
		if (this.hasSource(id)) this.map.removeSource(id);
		this.sources.delete(id);
	}

	setPaint(layerId: string, property: string, value: unknown): void {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if (this.hasLayer(layerId)) this.map.setPaintProperty(layerId, property as any, value);
	}

	setLayout(layerId: string, property: string, value: unknown): void {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if (this.hasLayer(layerId)) this.map.setLayoutProperty(layerId, property as any, value);
	}

	setFilter(layerId: string, filter: FilterSpecification | null): void {
		if (this.hasLayer(layerId)) this.map.setFilter(layerId, filter ?? undefined);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	on(type: MapEventName, fn: (e: any) => void): void;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	on(type: MapEventName, layerId: string, fn: (e: any) => void): void;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	on(type: MapEventName, layerIdOrFn: string | ((e: any) => void), maybeFn?: (e: any) => void) {
		if (typeof layerIdOrFn === 'string' && maybeFn) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			this.map.on(type as any, layerIdOrFn, maybeFn);
			this.handlers.push({ type, layerId: layerIdOrFn, fn: maybeFn });
		} else if (typeof layerIdOrFn === 'function') {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			this.map.on(type as any, layerIdOrFn);
			this.handlers.push({ type, fn: layerIdOrFn });
		}
	}

	addMarker(marker: maplibregl.Marker): maplibregl.Marker {
		marker.addTo(this.map);
		this.markers.add(marker);
		return marker;
	}

	removeMarker(marker: maplibregl.Marker): void {
		marker.remove();
		this.markers.delete(marker);
	}

	addPopup(popup: maplibregl.Popup): maplibregl.Popup {
		popup.addTo(this.map);
		this.popups.add(popup);
		return popup;
	}

	reset(): void {
		const map = this.store.map;
		if (!map) return;
		for (const h of this.handlers) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			if (h.layerId) map.off(h.type as any, h.layerId, h.fn);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			else map.off(h.type as any, h.fn);
		}
		this.handlers = [];
		for (const p of this.popups) p.remove();
		this.popups.clear();
		for (const m of this.markers) m.remove();
		this.markers.clear();
		for (const id of this.layers) {
			if (map.getLayer(id)) map.removeLayer(id);
		}
		this.layers.clear();
		for (const id of this.sources) {
			if (map.getSource(id)) map.removeSource(id);
		}
		this.sources.clear();
		map.getCanvas().style.cursor = '';
	}

	/** Layer ids currently registered by the active demo (for context snapshot). */
	get layerIds(): string[] {
		return [...this.layers];
	}
}

export class MapStore {
	/** Plain field, intentionally non-reactive. */
	map: maplibregl.Map | null = null;

	loaded = $state(false);
	visible = $state(true);
	basemap = $state<BasemapId>('streets');
	viewport = $state<Viewport>({
		center: [105.746, 10.045],
		zoom: 12,
		bearing: 0,
		pitch: 0,
		bounds: null
	});
	/** Bumped whenever the active demo scene changes layers (for snapshot refresh). */
	sceneVersion = $state(0);
	/** Plain shadow counter so bumps never read reactive state inside effects. */
	private versionCounter = 0;

	scene = new Scene(this);

	/** Safe to call from inside $effects — write-only, no reactive read. */
	bumpScene(): void {
		this.sceneVersion = ++this.versionCounter;
	}

	private readyResolvers: ((map: maplibregl.Map) => void)[] = [];

	/** Called once by MapShell when the map's `load` event fires. */
	attach(map: maplibregl.Map): void {
		this.map = map;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if (import.meta.env.DEV) (globalThis as any).__map = map;
		this.loaded = true;
		this.syncViewport();
		map.on('moveend', () => this.syncViewport());
		for (const resolve of this.readyResolvers) resolve(map);
		this.readyResolvers = [];
	}

	detach(): void {
		this.map = null;
		this.loaded = false;
	}

	whenReady(): Promise<maplibregl.Map> {
		if (this.map && this.loaded) return Promise.resolve(this.map);
		return new Promise((resolve) => this.readyResolvers.push(resolve));
	}

	private syncViewport(): void {
		const map = this.map;
		if (!map) return;
		const c = map.getCenter();
		const b = map.getBounds();
		this.viewport = {
			center: [Number(c.lng.toFixed(6)), Number(c.lat.toFixed(6))],
			zoom: Number(map.getZoom().toFixed(3)),
			bearing: Number(map.getBearing().toFixed(1)),
			pitch: Number(map.getPitch().toFixed(1)),
			bounds: [
				[b.getWest(), b.getSouth()],
				[b.getEast(), b.getNorth()]
			]
		};
	}

	async setBasemap(id: BasemapId): Promise<void> {
		const map = await this.whenReady();
		const streets = id === 'streets' ? 'visible' : 'none';
		for (const layerId of VECTOR_BASEMAP_LAYER_IDS) {
			if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', streets);
		}
		map.setLayoutProperty(
			SATELLITE_LAYER_ID,
			'visibility',
			id === 'satellite' ? 'visible' : 'none'
		);
		this.basemap = id;
	}

	async jumpTo(camera: CameraTarget): Promise<void> {
		const map = await this.whenReady();
		map.jumpTo({ ...camera, pitch: camera.pitch ?? 0, bearing: camera.bearing ?? 0 });
	}

	async flyTo(camera: CameraTarget, durationMs = 2200): Promise<void> {
		const map = await this.whenReady();
		map.flyTo({ ...camera, duration: durationMs, essential: true });
	}

	async easeTo(camera: CameraTarget, durationMs = 800): Promise<void> {
		const map = await this.whenReady();
		map.easeTo({ ...camera, duration: durationMs });
	}

	async fitBounds(bounds: LngLatBoundsLike, padding = 48): Promise<void> {
		const map = await this.whenReady();
		map.fitBounds(bounds, { padding, duration: 1200 });
	}

	resetScene(): void {
		this.scene.reset();
		this.bumpScene();
	}
}

export const mapStore = new MapStore();
