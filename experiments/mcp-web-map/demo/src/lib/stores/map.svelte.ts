import type { Map as MapLibreMap, LngLatBoundsLike } from 'maplibre-gl';

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

  // Map initialization status
  status = $state<MapStatus>('idle');
  error = $state<string | null>(null);

  // Map instance reference (set by MapView)
  private mapInstance: MapLibreMap | null = null;

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
}

// Export singleton instance
export const mapStore = new MapStore();
