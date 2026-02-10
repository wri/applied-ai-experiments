<script lang="ts">
  import type { BYOKStores } from '@byo-keys/svelte';
  import type { ProviderId, ModelInfo, LLMProvider, KeyStatus } from '@byo-keys/core';
  import type { ModelSelectorConfig } from './types';
  import Badge from '../components/Badge.svelte';
  import Tabs from '../components/Tabs.svelte';
  import SearchInput from '../components/SearchInput.svelte';
  import Button from '../components/Button.svelte';

  interface Props {
    /** BYOK stores instance */
    stores: BYOKStores;
    /** Static model configuration (uses dynamic models from BYOK if not provided) */
    config?: ModelSelectorConfig;
    /** Currently selected provider ID (bindable) */
    providerId?: ProviderId;
    /** Currently selected model ID (bindable) */
    modelId?: string;
    /** Callback when a model is selected */
    onselect?: (providerId: ProviderId, modelId: string) => void;
    /** Show as compact trigger button (default: true) */
    compact?: boolean;
    /** Additional CSS class */
    class?: string;
  }

  let {
    stores,
    config,
    providerId = $bindable('' as ProviderId),
    modelId = $bindable(''),
    onselect,
    compact = true,
    class: className = '',
  }: Props = $props();

  // State
  let isOpen = $state(false);
  let searchQuery = $state('');

  // Subscribe to store data for dynamic mode
  let dynamicModels: Partial<Record<ProviderId, ModelInfo[]>> = $state({});
  let selectedModelState: Partial<Record<ProviderId, string | undefined>> = $state({});
  let keys: Partial<Record<ProviderId, KeyStatus>> = $state({});
  let allProviders: LLMProvider[] = $state([]);

  $effect(() => {
    const unsub1 = stores.models.subscribe((value) => { dynamicModels = value; });
    const unsub2 = stores.selectedModels.subscribe((value) => { selectedModelState = value; });
    const unsub3 = stores.keys.subscribe((value) => { keys = value; });
    const unsub4 = stores.providers.subscribe((value) => { allProviders = value; });
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  });

  // Check if a provider has a valid key
  function isProviderReady(id: ProviderId): boolean {
    const status = keys[id];
    return status?.hasKey === true && status?.isValid === true;
  }

  // Check if a provider requires a key
  function providerRequiresKey(id: ProviderId): boolean {
    const provider = allProviders.find(p => p.config.id === id);
    return provider?.config.requiresKey ?? true;
  }

  // Check if a provider needs key configuration (requires key but doesn't have one)
  function providerNeedsKey(id: ProviderId): boolean {
    return providerRequiresKey(id) && !isProviderReady(id);
  }

  // Get available provider IDs based on config or dynamic
  const availableProviderIds = $derived.by(() => {
    if (config) {
      // Config mode: show ALL providers from config (regardless of key status)
      return Object.keys(config.providers) as ProviderId[];
    } else {
      // Dynamic mode: use providers that have valid keys
      return allProviders
        .filter(p => !p.config.requiresKey || isProviderReady(p.config.id))
        .map(p => p.config.id);
    }
  });

  // Get provider display info
  function getProviderInfo(id: ProviderId): { id: ProviderId; name: string; needsKey: boolean } {
    const needsKey = providerNeedsKey(id);
    if (config?.providers[id]) {
      return { id, name: config.providers[id]!.name, needsKey };
    }
    const provider = allProviders.find(p => p.config.id === id);
    return { id, name: provider?.config.name ?? id, needsKey };
  }

  // Get models for a provider
  function getModelsForProvider(id: ProviderId): ModelInfo[] {
    if (config?.providers[id]) {
      // Config mode: convert ModelConfig to ModelInfo
      return config.providers[id]!.models.map(m => ({
        ...m,
        provider: id,
      }));
    }
    // Dynamic mode: use models from BYOK stores
    return dynamicModels[id] ?? [];
  }

  // Get default model for a provider
  function getDefaultModel(id: ProviderId): string | undefined {
    if (config?.providers[id]?.defaultModel) {
      return config.providers[id]!.defaultModel;
    }
    const models = getModelsForProvider(id);
    return selectedModelState[id] ?? models[0]?.id;
  }

  // Derive active provider - use prop or first available provider
  const activeProviderId = $derived(
    providerId && availableProviderIds.includes(providerId)
      ? providerId
      : availableProviderIds[0]
  );

  // Auto-set modelId when providerId changes and modelId is empty
  $effect(() => {
    if (activeProviderId && !modelId) {
      const defaultModel = getDefaultModel(activeProviderId);
      if (defaultModel) {
        modelId = defaultModel;
      }
    }
  });

  // Get models for active provider
  const activeModels = $derived(activeProviderId ? getModelsForProvider(activeProviderId) : []);

  // Filter models by search query
  const filteredModels = $derived(
    activeModels.filter(m =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.id.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  // Get display info for trigger button
  const selectedProviderInfo = $derived(activeProviderId ? getProviderInfo(activeProviderId) : null);
  const selectedModel = $derived(activeModels.find(m => m.id === modelId));

  // Tab items for provider switching
  const tabItems = $derived(
    availableProviderIds.map(id => getProviderInfo(id)).map(p => ({
      id: p.id,
      label: p.needsKey ? `${p.name} 🔑` : p.name,
    }))
  );

  // Check if the active provider needs a key
  const activeProviderNeedsKey = $derived(activeProviderId ? providerNeedsKey(activeProviderId) : false);

  function handleOpen() {
    isOpen = true;
    searchQuery = '';
  }

  function handleClose() {
    isOpen = false;
  }

  function handleProviderChange(id: string) {
    providerId = id as ProviderId;
    // Update modelId to provider's default model
    const defaultModel = getDefaultModel(providerId);
    modelId = defaultModel ?? getModelsForProvider(providerId)[0]?.id ?? '';
  }

  function handleModelSelect(model: ModelInfo) {
    modelId = model.id;
    // Only call stores.selectModel in dynamic mode
    if (!config && activeProviderId) {
      try {
        stores.selectModel(activeProviderId, model.id);
      } catch {
        // Model might not be in BYOK's model list, ignore
      }
    }
    onselect?.(activeProviderId, model.id);
    handleClose();
  }

  function formatContextWindow(tokens?: number): string {
    if (!tokens) return '';
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
    return String(tokens);
  }

  function formatPrice(price?: number): string {
    if (!price) return '';
    return `$${price.toFixed(2)}/M`;
  }

  function getCapabilityBadges(capabilities?: ModelInfo['capabilities']): string[] {
    if (!capabilities) return [];
    const badges: string[] = [];
    if (capabilities.vision) badges.push('Vision');
    if (capabilities.functionCalling) badges.push('Tools');
    if (capabilities.streaming) badges.push('Stream');
    if (capabilities.audio) badges.push('Audio');
    return badges;
  }

  // Handle backdrop click
  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  // Handle escape key
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    }
  }
</script>

<svelte:window onkeydown={isOpen ? handleKeydown : undefined} />

<div class="ui-model-selector {className}">
  {#if compact}
    <button
      type="button"
      class="trigger"
      onclick={handleOpen}
      disabled={availableProviderIds.length === 0}
      style="
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        background: var(--bg-2);
        border: 1px solid {activeProviderNeedsKey ? 'var(--warning)' : 'var(--ui)'};
        border-radius: var(--radius-md);
        font-family: var(--font-mono);
        font-size: var(--text-ui);
        color: var(--tx);
        cursor: pointer;
        transition: all var(--transition-fast);
      "
    >
      {#if selectedProviderInfo && selectedModel}
        <span style="color: var(--tx-2);">{selectedProviderInfo.name}</span>
        <span style="color: var(--tx-3);">/</span>
        <span>{selectedModel.name}</span>
        {#if activeProviderNeedsKey}
          <span style="color: var(--warning);" title="API key required">🔑</span>
        {/if}
      {:else if availableProviderIds.length === 0}
        <span style="color: var(--tx-3);">No models configured</span>
      {:else}
        <span style="color: var(--tx-2);">Select model</span>
      {/if}
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        style="color: var(--tx-3);"
      >
        <path d="M3 5L6 8L9 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  {:else}
    <Button variant="secondary" onclick={handleOpen} disabled={availableProviderIds.length === 0}>
      {#if selectedProviderInfo && selectedModel}
        {selectedProviderInfo.name} / {selectedModel.name}
        {#if activeProviderNeedsKey}
          🔑
        {/if}
      {:else}
        Select model
      {/if}
    </Button>
  {/if}

  {#if isOpen}
    <div
      class="backdrop"
      role="button"
      tabindex="-1"
      onclick={handleBackdropClick}
      onkeydown={handleKeydown}
      style="
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      "
    >
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-selector-title"
        style="
          width: min(480px, calc(100vw - 2rem));
          max-height: min(600px, calc(100vh - 2rem));
          background: var(--bg);
          border: 1px solid var(--ui);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        "
      >
        <!-- Header -->
        <div
          style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: var(--space-4);
            border-bottom: 1px solid var(--ui);
          "
        >
          <h2
            id="model-selector-title"
            style="
              margin: 0;
              font-family: var(--font-mono);
              font-size: var(--text-label);
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: var(--tx);
            "
          >
            Select Model
          </h2>
          <button
            type="button"
            onclick={handleClose}
            aria-label="Close"
            style="
              display: flex;
              align-items: center;
              justify-content: center;
              width: 2rem;
              height: 2rem;
              padding: 0;
              background: transparent;
              border: none;
              border-radius: var(--radius-sm);
              color: var(--tx-2);
              cursor: pointer;
              transition: all var(--transition-fast);
            "
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M4 12L12 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- Provider tabs (only if multiple providers) -->
        {#if availableProviderIds.length > 1}
          <div style="padding: var(--space-3) var(--space-4) 0;">
            <Tabs
              items={tabItems}
              active={activeProviderId}
              size="sm"
              onchange={handleProviderChange}
            />
          </div>
        {/if}

        <!-- API Key Notice -->
        {#if activeProviderNeedsKey}
          <div
            style="
              margin: var(--space-3) var(--space-4) 0;
              padding: var(--space-3);
              background: var(--warning-subtle);
              border: 1px solid var(--warning);
              border-radius: var(--radius-md);
              font-size: var(--text-badge);
              color: var(--warning-text);
              display: flex;
              align-items: center;
              gap: var(--space-2);
            "
          >
            <span>🔑</span>
            <span>Configure API key in settings to use {selectedProviderInfo?.name ?? 'this provider'}</span>
          </div>
        {/if}

        <!-- Search -->
        <div style="padding: var(--space-3) var(--space-4);">
          <SearchInput
            bind:value={searchQuery}
            placeholder="Search models..."
          />
        </div>

        <!-- Model list -->
        <div
          class="model-list"
          style="
            flex: 1;
            overflow-y: auto;
            padding: 0 var(--space-4) var(--space-4);
          "
        >
          {#if filteredModels.length === 0}
            <div
              style="
                padding: var(--space-6);
                text-align: center;
                color: var(--tx-3);
              "
            >
              {#if searchQuery}
                No models found matching "{searchQuery}"
              {:else}
                No models available
              {/if}
            </div>
          {:else}
            <div style="display: flex; flex-direction: column; gap: var(--space-2);">
              {#each filteredModels as model}
                {@const isSelected = model.id === modelId}
                {@const capabilities = getCapabilityBadges(model.capabilities)}
                <button
                  type="button"
                  onclick={() => handleModelSelect(model)}
                  style="
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-1);
                    padding: var(--space-3);
                    background: {isSelected ? 'var(--bg-3)' : 'var(--bg-2)'};
                    border: 1px solid {isSelected ? 'var(--primary)' : 'var(--ui)'};
                    border-radius: var(--radius-md);
                    text-align: left;
                    cursor: pointer;
                    transition: all var(--transition-fast);
                  "
                >
                  <!-- Model name and selected badge -->
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-2);">
                    <span
                      style="
                        font-family: var(--font-mono);
                        font-size: var(--text-body);
                        font-weight: 500;
                        color: var(--tx);
                      "
                    >
                      {model.name}
                    </span>
                    {#if isSelected}
                      <Badge variant="success">Selected</Badge>
                    {/if}
                  </div>

                  <!-- Context and price info -->
                  <div
                    style="
                      display: flex;
                      gap: var(--space-3);
                      font-family: var(--font-mono);
                      font-size: var(--text-badge);
                      color: var(--tx-2);
                    "
                  >
                    {#if model.contextWindow}
                      <span>{formatContextWindow(model.contextWindow)} context</span>
                    {/if}
                    {#if model.inputPricePerMillion}
                      <span>{formatPrice(model.inputPricePerMillion)} in</span>
                    {/if}
                    {#if model.outputPricePerMillion}
                      <span>{formatPrice(model.outputPricePerMillion)} out</span>
                    {/if}
                  </div>

                  <!-- Capability badges -->
                  {#if capabilities.length > 0}
                    <div style="display: flex; gap: var(--space-1); flex-wrap: wrap; margin-top: var(--space-1);">
                      {#each capabilities as cap}
                        <Badge>{cap}</Badge>
                      {/each}
                    </div>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .trigger:hover:not(:disabled) {
    background: var(--bg-3);
    border-color: var(--ui-2);
  }

  .trigger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .modal button:hover:not([disabled]) {
    background: var(--bg-3) !important;
  }

  .model-list::-webkit-scrollbar {
    width: 6px;
  }

  .model-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .model-list::-webkit-scrollbar-thumb {
    background: var(--ui);
    border-radius: 3px;
  }
</style>
