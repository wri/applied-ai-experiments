<script lang="ts">
  import { browser } from '$app/environment';
  import type { Snippet } from 'svelte';
  import type { BYOKStores } from '@byo-keys/svelte';

  interface Props {
    children: Snippet<[{ stores: BYOKStores }]>;
  }

  let { children }: Props = $props();

  let stores = $state<BYOKStores | null>(null);
  let error = $state<string | null>(null);
  let status = $state<string>('waiting');

  // Use $effect instead of onMount for Svelte 5
  $effect(() => {
    if (!browser) return;
    if (stores || error) return; // Already initialized or failed

    status = 'importing';

    (async () => {
      try {
        // Dynamic imports to avoid SSR issues
        const [coreModule, svelteModule, providersModule] = await Promise.all([
          import('@byo-keys/core'),
          import('@byo-keys/svelte'),
          import('@byo-keys/providers'),
        ]);

        status = 'creating client';

        const { createBYOKClient } = coreModule;
        const { createBYOKStores } = svelteModule;
        const { openai, anthropic, gemini, groq, ollama } = providersModule;

        // Create a demo client with common providers
        const client = createBYOKClient({
          providers: [
            openai(),
            anthropic(),
            gemini(),
            groq(),
            ollama(),
          ],
          storage: {
            type: 'memory', // Use memory storage for demo (no persistence)
          },
        });

        status = 'creating stores';
        const newStores = createBYOKStores(client);

        status = 'initializing';
        // Initialize (loads any stored keys from memory - will be empty)
        await newStores.initialize();

        status = 'ready';
        stores = newStores;
      } catch (e) {
        console.error('BYOKPreview initialization failed:', e);
        error = e instanceof Error ? e.message : String(e);
        status = 'error';
      }
    })();
  });
</script>

{#if !browser}
  <div class="loading-placeholder">
    <div class="loading-spinner"></div>
    <span>Loading component preview...</span>
  </div>
{:else if error}
  <div class="error-state">
    <p><strong>Failed to load BYOK preview</strong></p>
    <p>{error}</p>
    <p style="font-size: 0.75rem; color: var(--tx-3);">Status: {status}</p>
  </div>
{:else if stores}
  {@render children({ stores })}
{:else}
  <div class="loading-placeholder">
    <div class="loading-spinner"></div>
    <span>Initializing BYOK stores... ({status})</span>
  </div>
{/if}

<style>
  .loading-placeholder {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem;
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: 0.25rem;
    color: var(--tx-2);
  }

  .loading-spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid var(--ui);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-state {
    padding: 1rem;
    background: var(--danger-subtle);
    border: 1px solid var(--danger);
    border-radius: 0.25rem;
    color: var(--danger-text);
  }

  .error-state p {
    margin: 0;
  }

  .error-state p + p {
    margin-top: 0.5rem;
    font-size: 0.875rem;
  }
</style>
