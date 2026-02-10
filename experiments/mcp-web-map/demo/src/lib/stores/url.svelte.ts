import { browser } from '$app/environment';
import { mapStore, type MapViewState } from './map.svelte';

// URL State format: #@lng,lat,zoom,bearing,pitch;layers=a,b,c

export interface UrlState {
  view: MapViewState;
  layers?: string[];
}

// Parse URL hash to state
export function parseUrlState(): UrlState | null {
  if (!browser) return null;

  const hash = window.location.hash;
  if (!hash || !hash.startsWith('#@')) return null;

  try {
    const content = hash.slice(2); // Remove '#@'
    const [viewPart, layersPart] = content.split(';');

    // Parse view: lng,lat,zoom,bearing,pitch
    const viewParts = viewPart.split(',').map(Number);
    if (viewParts.length < 3 || viewParts.some(isNaN)) return null;

    const view: MapViewState = {
      center: [viewParts[0], viewParts[1]],
      zoom: viewParts[2],
      bearing: viewParts[3] ?? 0,
      pitch: viewParts[4] ?? 0,
    };

    // Parse layers if present
    let layers: string[] | undefined;
    if (layersPart?.startsWith('layers=')) {
      const layerStr = layersPart.slice(7);
      layers = layerStr ? layerStr.split(',') : [];
    }

    return { view, layers };
  } catch (e) {
    console.error('Failed to parse URL state:', e);
    return null;
  }
}

// Encode state to URL hash
export function encodeUrlState(state: UrlState): string {
  const { view, layers } = state;

  // Format view values with appropriate precision
  const viewStr = [
    view.center[0].toFixed(5),
    view.center[1].toFixed(5),
    view.zoom.toFixed(2),
    view.bearing.toFixed(1),
    view.pitch.toFixed(1),
  ].join(',');

  let hash = `#@${viewStr}`;

  // Add layers if specified
  if (layers && layers.length > 0) {
    hash += `;layers=${layers.join(',')}`;
  }

  return hash;
}

// Update URL without triggering navigation
export function updateUrl(state: UrlState) {
  if (!browser) return;

  const hash = encodeUrlState(state);
  const url = new URL(window.location.href);
  url.hash = hash;

  // Use replaceState to avoid creating history entries
  window.history.replaceState(null, '', url.toString());
}

// Debounced URL update
let urlUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

export function debouncedUpdateUrl(state: UrlState, delay = 300) {
  if (urlUpdateTimeout) {
    clearTimeout(urlUpdateTimeout);
  }

  urlUpdateTimeout = setTimeout(() => {
    updateUrl(state);
    urlUpdateTimeout = null;
  }, delay);
}

// Generate a shareable URL
export function getShareableUrl(): string {
  if (!browser) return '';

  const state: UrlState = {
    view: mapStore.view,
    layers: mapStore.layers
      .filter((l) => l.visible)
      .map((l) => l.id),
  };

  const url = new URL(window.location.href);
  url.hash = encodeUrlState(state);

  return url.toString();
}

// Copy URL to clipboard
export async function copyShareableUrl(): Promise<boolean> {
  if (!browser) return false;

  try {
    const url = getShareableUrl();
    await navigator.clipboard.writeText(url);
    return true;
  } catch (e) {
    console.error('Failed to copy URL:', e);
    return false;
  }
}
