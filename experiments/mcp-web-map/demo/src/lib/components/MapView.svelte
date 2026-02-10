<script lang="ts">
  import { untrack } from 'svelte';
  import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
  import { mapStore } from '../stores/map.svelte';
  import { parseUrlState, debouncedUpdateUrl } from '../stores/url.svelte';
  import { browser } from '$app/environment';

  interface Props {
    class?: string;
  }

  let { class: className = '' }: Props = $props();

  let container: HTMLDivElement;
  let mapInitialized = false;

  // Default basemap style
  const defaultStyle: maplibregl.StyleSpecification = {
    version: 8,
    sources: {
      carto: {
        type: 'raster',
        tiles: [
          'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
      satellite: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: 'Tiles &copy; Esri',
      },
    },
    layers: [
      {
        id: 'carto-base',
        type: 'raster',
        source: 'carto',
        minzoom: 0,
        maxzoom: 22,
      },
      {
        id: 'satellite',
        type: 'raster',
        source: 'satellite',
        minzoom: 0,
        maxzoom: 22,
        layout: {
          visibility: 'none',
        },
      },
    ],
  };

  // Initialize map when container becomes available
  $effect(() => {
    // Track container to re-run when it's bound
    const currentContainer = container;

    // Run initialization logic outside of reactive tracking
    untrack(() => {
      if (!browser || !currentContainer || mapInitialized) return;

      mapInitialized = true;

      // Check for URL state
      const urlState = parseUrlState();
      const initialView = urlState?.view ?? mapStore.view;

      // Create map instance
      let map: MapLibreMap;
      try {
        map = new MapLibreMap({
          container: currentContainer,
          style: defaultStyle,
          center: initialView.center,
          zoom: initialView.zoom,
          bearing: initialView.bearing,
          pitch: initialView.pitch,
        });
      } catch (err) {
        mapStore.status = 'error';
        mapStore.error = err instanceof Error ? err.message : 'Failed to create map';
        mapInitialized = false;
        return;
      }

      // Initialize with timeout - handles 'load' event and status transitions
      mapStore.initializeMap(map, { timeout: 10000 });

      // Apply URL layer visibility after map is ready
      map.once('load', () => {
        if (urlState?.layers) {
          const visibleLayers = new Set(urlState.layers);
          mapStore.layers.forEach((layer) => {
            const shouldBeVisible = visibleLayers.has(layer.id);
            if (layer.visible !== shouldBeVisible) {
              mapStore.setLayerVisibility(layer.id, shouldBeVisible);
            }
          });
        }
      });

      // Sync state on view changes
      map.on('moveend', () => {
        mapStore.syncFromMap();
        debouncedUpdateUrl({ view: mapStore.view });
      });

      // Add navigation controls
      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      map.addControl(new maplibregl.ScaleControl(), 'bottom-left');
    });

    // Cleanup when component unmounts
    return () => {
      untrack(() => {
        mapStore.reset();
        mapInitialized = false;
      });
    };
  });
</script>

<div class="map-container {className}" bind:this={container}></div>

<style>
  .map-container {
    width: 100%;
    height: 100%;
    min-height: 300px;
  }
</style>
