import maplibregl, {
  type Map as MapLibreMap,
  type LngLatBoundsLike,
  type FilterSpecification,
  type Marker,
} from 'maplibre-gl';
import { base } from '$app/paths';

// Minimal GeoJSON aliases (avoids depending on @types/geojson resolution)
export type GeoJSONFeature = {
  type: 'Feature';
  properties: Record<string, unknown> | null;
  geometry: { type: string; coordinates: unknown } | null;
};
export type GeoJSONFeatureCollection = {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
};

// Map view state
export interface MapViewState {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

// Layer info
export interface LayerInfo {
  id: string;
  type: string;
  visible: boolean;
  source?: string;
}

// A data layer added at runtime by a tool (vs. the static basemap layers)
export interface ManagedLayer {
  id: string;
  sourceId: string;
  kind: 'fill' | 'line' | 'circle';
  datasetKey?: string;
  label: string;
  featureCount: number;
}

// Accent palette reused for default layer styling + choropleth ramps
const ACCENT = '#f59e0b';
const CHOROPLETH_RAMP = ['#fef3c7', '#fcd34d', '#f59e0b', '#d97706', '#92400e'];
const MARKER_SOURCE = 'mcp-markers';

// Map initialization status
export type MapStatus = 'idle' | 'initializing' | 'ready' | 'error';

// Map store state
class MapStore {
  // Current view state
  view = $state<MapViewState>({
    center: [-74.006, 40.7128], // NYC default
    zoom: 10,
    bearing: 0,
    pitch: 0,
  });

  // Available layers
  layers = $state<LayerInfo[]>([]);

  // Currently highlighted feature IDs
  highlightedFeatures = $state<string[]>([]);
  highlightSourceId = $state<string | null>(null);

  // Data layers added at runtime by tools (reactive, for UI)
  managedLayers = $state<ManagedLayer[]>([]);
  markerCount = $state(0);

  // Map initialization status
  status = $state<MapStatus>('idle');
  error = $state<string | null>(null);

  // Map instance reference (set by MapView)
  private mapInstance: MapLibreMap | null = null;

  // Non-reactive caches: raw GeoJSON per managed source + DOM markers + fetched datasets
  private managedData = new Map<string, GeoJSONFeatureCollection>();
  private markerInstances: Marker[] = [];
  private datasetCache = new Map<string, GeoJSONFeatureCollection>();

  // Promise machinery for awaiting ready state
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((error: Error) => void) | null = null;

  // Derived convenience getters
  get isReady(): boolean {
    return this.status === 'ready';
  }

  get isLoading(): boolean {
    return this.status === 'initializing';
  }

  // Initialize map with timeout protection
  initializeMap(map: MapLibreMap, options?: { timeout?: number }): void {
    const timeout = options?.timeout ?? 10000;

    this.status = 'initializing';
    this.error = null;
    this.mapInstance = map;

    // Create the ready promise
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });

    const markReady = () => {
      if (this.status !== 'initializing') return; // Already resolved
      this.status = 'ready';
      this.syncFromMap();
      this.readyResolve?.();
    };

    // Check if map style is already loaded (can happen in some cases)
    if (map.isStyleLoaded()) {
      markReady();
      return;
    }

    // Set up timeout protection
    const timeoutId = setTimeout(() => {
      if (this.status === 'initializing') {
        this.status = 'error';
        this.error = `Map initialization timed out after ${timeout}ms`;
        this.readyReject?.(new Error(this.error));
      }
    }, timeout);

    // Handle successful load - use 'load' event which fires when style is fully loaded
    map.once('load', () => {
      clearTimeout(timeoutId);
      markReady();
    });

    // Fallback: also listen for 'idle' in case 'load' was missed
    map.once('idle', () => {
      clearTimeout(timeoutId);
      markReady();
    });

    // Handle map errors
    map.once('error', (e) => {
      clearTimeout(timeoutId);
      this.status = 'error';
      const errorMessage = e.error?.message || 'Unknown map error';
      this.error = errorMessage;
      this.readyReject?.(new Error(errorMessage));
    });
  }

  // Wait for map to be ready - tools call this before executing
  async waitForReady(): Promise<void> {
    if (this.status === 'ready') return;
    if (this.status === 'error') throw new Error(this.error || 'Map initialization failed');
    if (this.status === 'idle') throw new Error('Map not yet initialized');
    return this.readyPromise!;
  }

  // Clean reset for unmount/retry
  reset(): void {
    this.clearMarkers();
    if (this.mapInstance) {
      this.mapInstance.remove();
    }
    this.mapInstance = null;
    this.status = 'idle';
    this.error = null;
    this.readyPromise = null;
    this.readyResolve = null;
    this.readyReject = null;
    this.layers = [];
    this.managedLayers = [];
    this.managedData.clear();
  }

  getMap(): MapLibreMap | null {
    return this.mapInstance;
  }

  // Sync state from map instance
  syncFromMap() {
    if (!this.mapInstance) return;

    const center = this.mapInstance.getCenter();
    this.view = {
      center: [center.lng, center.lat],
      zoom: this.mapInstance.getZoom(),
      bearing: this.mapInstance.getBearing(),
      pitch: this.mapInstance.getPitch(),
    };

    this.updateLayers();
  }

  // Update layers list from map
  updateLayers() {
    if (!this.mapInstance) return;

    const style = this.mapInstance.getStyle();
    if (!style?.layers) return;

    this.layers = style.layers.map((layer) => ({
      id: layer.id,
      type: layer.type,
      visible: this.mapInstance!.getLayoutProperty(layer.id, 'visibility') !== 'none',
      source: 'source' in layer ? (layer.source as string) : undefined,
    }));
  }

  // Navigation methods
  flyTo(options: {
    center?: [number, number];
    zoom?: number;
    bearing?: number;
    pitch?: number;
    duration?: number;
  }) {
    if (!this.mapInstance || !this.mapInstance.isStyleLoaded()) {
      return;
    }

    // Build flyTo options, only including defined values
    const flyToOptions: Parameters<typeof this.mapInstance.flyTo>[0] = {
      duration: options.duration ?? 2000,
    };

    if (options.center) {
      flyToOptions.center = options.center;
    }
    if (options.zoom !== undefined) {
      flyToOptions.zoom = options.zoom;
    }
    if (options.bearing !== undefined) {
      flyToOptions.bearing = options.bearing;
    }
    if (options.pitch !== undefined) {
      flyToOptions.pitch = options.pitch;
    }

    this.mapInstance.flyTo(flyToOptions);
  }

  fitBounds(bounds: LngLatBoundsLike, options?: { padding?: number }) {
    if (!this.mapInstance) return;

    this.mapInstance.fitBounds(bounds, {
      padding: options?.padding ?? 50,
      duration: 2000,
    });
  }

  // Layer visibility
  setLayerVisibility(layerId: string, visible: boolean) {
    if (!this.mapInstance) return;

    try {
      this.mapInstance.setLayoutProperty(
        layerId,
        'visibility',
        visible ? 'visible' : 'none'
      );
      this.updateLayers();
    } catch (e) {
      console.error(`Failed to set visibility for layer ${layerId}:`, e);
    }
  }

  // Highlighting
  setHighlight(featureIds: string[], sourceId: string) {
    this.highlightedFeatures = featureIds;
    this.highlightSourceId = sourceId;
  }

  clearHighlight() {
    this.highlightedFeatures = [];
    this.highlightSourceId = null;
  }

  // ---- Datasets ----------------------------------------------------------

  // Fetch a bundled GeoJSON dataset from /static/data, cached after first load.
  async loadDataset(key: string): Promise<GeoJSONFeatureCollection> {
    const cached = this.datasetCache.get(key);
    if (cached) return cached;

    const safe = key.replace(/[^a-z0-9_-]/gi, '');
    const res = await fetch(`${base}/data/${safe}.geojson`);
    if (!res.ok) {
      throw new Error(`Dataset "${key}" not found (HTTP ${res.status})`);
    }
    const data = (await res.json()) as GeoJSONFeatureCollection;
    if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
      throw new Error(`Dataset "${key}" is not a valid GeoJSON FeatureCollection`);
    }
    this.datasetCache.set(key, data);
    return data;
  }

  // ---- Managed data layers ----------------------------------------------

  // Add (or replace) a GeoJSON data layer on the map. Returns layer metadata.
  addGeoJSONLayer(opts: {
    id: string;
    data: GeoJSONFeatureCollection;
    kind?: 'fill' | 'line' | 'circle';
    paint?: Record<string, unknown>;
    datasetKey?: string;
    label?: string;
  }): ManagedLayer {
    const map = this.mapInstance;
    if (!map) throw new Error('Map not initialized');

    const id = opts.id;
    const kind = opts.kind ?? 'fill';

    // Replace any existing managed layer/source with this id
    this.removeManagedLayer(id);

    map.addSource(id, { type: 'geojson', data: opts.data as never });

    const defaultPaint: Record<string, Record<string, unknown>> = {
      fill: { 'fill-color': ACCENT, 'fill-opacity': 0.45, 'fill-outline-color': '#92400e' },
      line: { 'line-color': ACCENT, 'line-width': 2 },
      circle: {
        'circle-radius': 5,
        'circle-color': ACCENT,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff',
      },
    };

    map.addLayer({
      id,
      type: kind,
      source: id,
      paint: { ...defaultPaint[kind], ...(opts.paint ?? {}) },
    } as never);

    this.managedData.set(id, opts.data);

    const meta: ManagedLayer = {
      id,
      sourceId: id,
      kind,
      datasetKey: opts.datasetKey,
      label: opts.label ?? id,
      featureCount: opts.data.features.length,
    };
    this.managedLayers = [...this.managedLayers.filter((l) => l.id !== id), meta];
    this.updateLayers();
    return meta;
  }

  removeManagedLayer(id: string): boolean {
    const map = this.mapInstance;
    if (!map) return false;
    let existed = false;
    if (map.getLayer(id)) {
      map.removeLayer(id);
      existed = true;
    }
    if (map.getSource(id)) {
      map.removeSource(id);
      existed = true;
    }
    this.managedData.delete(id);
    this.managedLayers = this.managedLayers.filter((l) => l.id !== id);
    if (existed) this.updateLayers();
    return existed;
  }

  getManagedLayer(id: string): ManagedLayer | undefined {
    return this.managedLayers.find((l) => l.id === id);
  }

  getManagedData(id: string): GeoJSONFeatureCollection | undefined {
    return this.managedData.get(id);
  }

  // Apply a data-driven paint property (e.g. choropleth color expression)
  setPaint(layerId: string, property: string, value: unknown): void {
    const map = this.mapInstance;
    if (!map || !map.getLayer(layerId)) {
      throw new Error(`Layer "${layerId}" not found`);
    }
    map.setPaintProperty(layerId, property, value as never);
  }

  // Apply / clear a MapLibre filter on a managed layer
  setFilter(layerId: string, filter: FilterSpecification | null): void {
    const map = this.mapInstance;
    if (!map || !map.getLayer(layerId)) {
      throw new Error(`Layer "${layerId}" not found`);
    }
    map.setFilter(layerId, filter as never);
  }

  // ---- Markers -----------------------------------------------------------

  // Add labeled DOM markers (with optional popups). Returns the new total.
  addMarkers(
    items: Array<{ lng: number; lat: number; label?: string; description?: string }>
  ): number {
    const map = this.mapInstance;
    if (!map) throw new Error('Map not initialized');

    for (const item of items) {
      const marker = new maplibregl.Marker({ color: ACCENT }).setLngLat([item.lng, item.lat]);
      if (item.label || item.description) {
        const title = item.label ? `<strong>${escapeHtml(item.label)}</strong>` : '';
        const body = item.description ? `<div>${escapeHtml(item.description)}</div>` : '';
        marker.setPopup(new maplibregl.Popup({ offset: 24 }).setHTML(`${title}${body}`));
      }
      marker.addTo(map);
      this.markerInstances.push(marker);
    }
    this.markerCount = this.markerInstances.length;
    return this.markerCount;
  }

  clearMarkers(): number {
    const removed = this.markerInstances.length;
    for (const marker of this.markerInstances) marker.remove();
    this.markerInstances = [];
    this.markerCount = 0;
    return removed;
  }

  // Source id for the conceptual marker collection (used by tools/UI)
  get markerSourceId(): string {
    return MARKER_SOURCE;
  }

  // Color ramp used for choropleth styling
  get choroplethRamp(): string[] {
    return [...CHOROPLETH_RAMP];
  }
}

// Escape user/LLM-provided strings before injecting into popup HTML
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Export singleton instance
export const mapStore = new MapStore();
