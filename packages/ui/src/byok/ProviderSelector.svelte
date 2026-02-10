<script lang="ts">
  import { createReadyProvidersStore, type BYOKStores } from '@byo-keys/svelte';
  import type { ProviderId, LLMProvider } from '@byo-keys/core';
  import Select from '../components/Select.svelte';
  import Badge from '../components/Badge.svelte';

  interface Props {
    value?: ProviderId;
    stores: BYOKStores;
    onlyReady?: boolean;
    label?: string;
    placeholder?: string;
    class?: string;
    onchange?: (providerId: ProviderId) => void;
  }

  let {
    value = $bindable('' as ProviderId),
    stores,
    onlyReady = true,
    label = 'Provider',
    placeholder = 'Select a provider',
    class: className = '',
    onchange,
  }: Props = $props();

  // Get providers
  let allProviders: LLMProvider[] = $state([]);
  let readyProviders: LLMProvider[] = $state([]);

  $effect(() => {
    const readyStore = createReadyProvidersStore(stores);
    const unsub1 = stores.providers.subscribe((value) => { allProviders = value; });
    const unsub2 = readyStore.subscribe((value) => { readyProviders = value; });
    return () => { unsub1(); unsub2(); };
  });

  const displayProviders = $derived(onlyReady ? readyProviders : allProviders);

  const options = $derived(
    displayProviders.map((p) => ({
      value: p.config.id,
      label: p.config.name,
    }))
  );

  function handleChange(newValue: ProviderId) {
    value = newValue;
    onchange?.(newValue);
  }
</script>

<div class="ui-provider-selector {className}">
  {#if displayProviders.length === 0}
    <div
      style="
        padding: 1rem;
        text-align: center;
        color: var(--tx-2);
        background-color: var(--bg-2);
        border: 1px dashed var(--ui);
        border-radius: var(--radius-md);
      "
    >
      <p style="margin: 0 0 0.5rem;">No providers configured</p>
      <p style="margin: 0; font-size: var(--font-size-sm);">
        Add an API key to get started
      </p>
    </div>
  {:else}
    <Select
      bind:value
      {options}
      {label}
      {placeholder}
      onchange={handleChange}
    />
    {#if value}
      {@const provider = displayProviders.find(p => p.config.id === value)}
      {#if provider?.config.models?.length}
        <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
          {#each provider.config.models.slice(0, 3) as model}
            <Badge>{model.name}</Badge>
          {/each}
          {#if provider.config.models.length > 3}
            <Badge variant="info">+{provider.config.models.length - 3} more</Badge>
          {/if}
        </div>
      {/if}
    {/if}
  {/if}
</div>
