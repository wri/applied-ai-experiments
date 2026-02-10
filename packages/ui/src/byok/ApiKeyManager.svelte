<script lang="ts">
  import type { BYOKStores } from '@byo-keys/svelte';
  import type { ProviderId, LLMProvider, KeyStatus } from '@byo-keys/core';
  import Badge from '../components/Badge.svelte';

  interface Props {
    stores: BYOKStores;
    providers?: ProviderId[];
    showAll?: boolean;
    class?: string;
  }

  let {
    stores,
    providers: filterProviders,
    showAll = true,
    class: className = '',
  }: Props = $props();

  let keyInputs = $state<Partial<Record<ProviderId, string>>>({});
  let validating = $state<Partial<Record<ProviderId, boolean>>>({});
  let errors = $state<Partial<Record<ProviderId, string>>>({});

  // Subscribe to store data
  let keys: Partial<Record<ProviderId, KeyStatus>> = $state({});
  let allProviders: LLMProvider[] = $state([]);

  $effect(() => {
    const unsub1 = stores.keys.subscribe((value) => { keys = value; });
    const unsub2 = stores.providers.subscribe((value) => { allProviders = value; });
    return () => { unsub1(); unsub2(); };
  });

  // Filter providers if specified
  const displayProviders = $derived(
    filterProviders
      ? allProviders.filter(p => filterProviders.includes(p.config.id))
      : showAll
        ? allProviders
        : allProviders.filter(p => p.config.requiresKey)
  );

  async function handleSaveKey(providerId: ProviderId) {
    const key = keyInputs[providerId]?.trim();
    if (!key) {
      errors[providerId] = 'Please enter an API key';
      return;
    }

    validating[providerId] = true;
    errors[providerId] = '';

    try {
      const result = await stores.setKey(providerId, key);
      if (result.valid) {
        keyInputs[providerId] = '';
      } else {
        errors[providerId] = result.error || 'Invalid API key';
      }
    } catch (e) {
      errors[providerId] = e instanceof Error ? e.message : 'Failed to validate key';
    } finally {
      validating[providerId] = false;
    }
  }

  async function handleRemoveKey(providerId: ProviderId) {
    try {
      await stores.removeKey(providerId);
    } catch (e) {
      errors[providerId] = e instanceof Error ? e.message : 'Failed to remove key';
    }
  }

  function getStatusBadge(status: KeyStatus | undefined): { variant: 'success' | 'error' | 'default'; text: string } {
    if (!status?.hasKey) {
      return { variant: 'default', text: 'Not set' };
    }
    if (status.isValid) {
      return { variant: 'success', text: 'Valid' };
    }
    return { variant: 'error', text: 'Invalid' };
  }
</script>

<div class="api-key-manager {className}">
  {#each displayProviders as provider}
    {@const status = keys[provider.config.id]}
    {@const badge = getStatusBadge(status)}
    <div class="provider-row">
      <div class="provider-info">
        <span class="provider-name">{provider.config.name}</span>
        <Badge variant={badge.variant}>{badge.text}</Badge>
      </div>

      <div class="provider-action">
        {#if status?.hasKey}
          <span class="key-preview">****{status.lastFourChars || '****'}</span>
          <button
            type="button"
            class="remove-btn"
            onclick={() => handleRemoveKey(provider.config.id)}
          >
            Remove
          </button>
        {:else}
          <form
            class="key-input-group"
            autocomplete="off"
            onsubmit={(e) => {
              e.preventDefault();
              handleSaveKey(provider.config.id);
            }}
          >
            <input
              type="password"
              class="key-input"
              class:has-error={errors[provider.config.id]}
              placeholder="API key"
              autocomplete="off"
              bind:value={keyInputs[provider.config.id]}
            />
            <button
              type="submit"
              class="save-btn"
              disabled={validating[provider.config.id]}
            >
              {#if validating[provider.config.id]}
                ...
              {:else}
                Save
              {/if}
            </button>
          </form>
        {/if}
      </div>
    </div>
    {#if errors[provider.config.id]}
      <div class="error-row">{errors[provider.config.id]}</div>
    {/if}
  {/each}
</div>

<style>
  .api-key-manager {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-size: 0.8125rem;
  }

  .provider-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: 0.25rem;
  }

  .provider-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .provider-name {
    font-family: var(--font-mono);
    font-weight: 500;
    color: var(--tx);
    white-space: nowrap;
  }

  .provider-action {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .key-preview {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--tx-2);
  }

  .key-input-group {
    display: flex;
    gap: 0.25rem;
  }

  .key-input {
    width: 140px;
    padding: 0.25rem 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    background: var(--bg);
    border: 1px solid var(--ui);
    border-radius: 0.125rem;
    color: var(--tx);
  }

  .key-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .key-input.has-error {
    border-color: var(--danger);
  }

  .key-input::placeholder {
    color: var(--tx-3);
  }

  .save-btn,
  .remove-btn {
    padding: 0.25rem 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    border: 1px solid var(--ui);
    border-radius: 0.125rem;
    cursor: pointer;
    transition: all 100ms;
  }

  .save-btn {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--bg);
  }

  .save-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .save-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .remove-btn {
    background: transparent;
    color: var(--danger);
    border-color: var(--danger);
  }

  .remove-btn:hover {
    background: var(--danger);
    color: var(--bg);
  }

  .error-row {
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    color: var(--danger);
  }
</style>
