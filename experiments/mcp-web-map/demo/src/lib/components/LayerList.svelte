<script lang="ts">
  import { Toggle } from '@wri-datalab/ui';
  import { mapStore, type LayerInfo } from '../stores/map.svelte';

  interface Props {
    collapsed?: boolean;
    class?: string;
  }

  let {
    collapsed = $bindable(false),
    class: className = '',
  }: Props = $props();

  // Filter to show only meaningful layers (skip internal MapLibre layers)
  const visibleLayers = $derived(
    mapStore.layers.filter((layer) => {
      // Show raster layers and any custom layers
      return layer.type === 'raster' ||
             !layer.id.startsWith('_') &&
             !layer.id.includes('maplibre');
    })
  );

  function toggleLayer(layerId: string, currentlyVisible: boolean) {
    mapStore.setLayerVisibility(layerId, !currentlyVisible);
  }

  function formatLayerName(id: string): string {
    // Convert kebab-case to Title Case
    return id
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
</script>

<div class="layer-list {className}" class:collapsed>
  <header class="panel-header">
    <button class="collapse-btn" onclick={() => (collapsed = !collapsed)} title={collapsed ? 'Expand' : 'Collapse'}>
      <span class="collapse-icon">{collapsed ? '▶' : '▼'}</span>
    </button>
    <span class="panel-title">Layers</span>
  </header>

  {#if !collapsed}
    <div class="layers">
      {#if visibleLayers.length === 0}
        <div class="empty-state">No layers available</div>
      {:else}
        {#each visibleLayers as layer (layer.id)}
          <div class="layer-item">
            <label class="layer-label">
              <input
                type="checkbox"
                checked={layer.visible}
                onchange={() => toggleLayer(layer.id, layer.visible)}
              />
              <span class="layer-name">{formatLayerName(layer.id)}</span>
              <span class="layer-type">{layer.type}</span>
            </label>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .layer-list {
    position: absolute;
    top: var(--space-4);
    left: var(--space-4);
    background: var(--bg);
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    min-width: 180px;
    max-width: 280px;
    z-index: 10;
    overflow: hidden;
  }

  .layer-list.collapsed {
    min-width: auto;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--bg-2);
    border-bottom: 1px solid var(--ui);
  }

  .collapsed .panel-header {
    border-bottom: none;
  }

  .collapse-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--tx-2);
    font-size: 0.625rem;
  }

  .collapse-btn:hover {
    color: var(--tx);
  }

  .panel-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--tx-2);
  }

  .layers {
    max-height: 240px;
    overflow-y: auto;
    padding: var(--space-2);
  }

  .layer-item {
    padding: var(--space-1) 0;
  }

  .layer-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    transition: background 0.1s ease;
  }

  .layer-label:hover {
    background: var(--bg-2);
  }

  .layer-label input[type="checkbox"] {
    width: 14px;
    height: 14px;
    accent-color: var(--primary);
  }

  .layer-name {
    flex: 1;
    font-size: 0.8125rem;
    color: var(--tx);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .layer-type {
    font-size: 0.6875rem;
    color: var(--tx-3);
    text-transform: uppercase;
  }

  .empty-state {
    padding: var(--space-4);
    text-align: center;
    color: var(--tx-3);
    font-size: 0.8125rem;
  }
</style>
