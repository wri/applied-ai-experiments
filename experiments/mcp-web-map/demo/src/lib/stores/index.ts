import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { createBYOKClient, createStorage } from '@byo-keys/core';
import { createBYOKStores, type BYOKStores } from '@byo-keys/svelte';
import { anthropic, gemini, openrouter, ollama, isLoopbackOrigin } from '@byo-keys/providers';

// Create BYOK client with supported providers
const client = createBYOKClient({
  providers: [
    anthropic({ dangerouslyAllowBrowser: true }),
    gemini(),
    openrouter(),
    ollama(),
  ],
  storage: browser
    ? createStorage({ backend: 'localStorage', prefix: 'mcp-web-map:keys:' })
    : createStorage({ backend: 'memory' }),
  autoValidate: true,
});

export const stores: BYOKStores = createBYOKStores(client);

// Loading state for store initialization
export const storesReady = writable(false);

// Initialize on client side
let initialized = false;
let initPromise: Promise<void> | null = null;

export function initStores(): Promise<void> {
  if (!browser) return Promise.resolve();

  if (initPromise) return initPromise;

  if (initialized) {
    storesReady.set(true);
    return Promise.resolve();
  }

  initialized = true;
  initPromise = stores.initialize()
    .then(() => {
      storesReady.set(true);
      // Auto-discover locally-pulled Ollama models. Only worth attempting from a
      // loopback origin: on a deployed https:// page the request to
      // localhost:11434 cannot succeed and only logs a CORS error.
      if (isLoopbackOrigin()) stores.refreshModels('ollama').catch(() => {});
    })
    .catch((error) => {
      console.error('Failed to initialize BYOK stores:', error);
      storesReady.set(true);
    });

  return initPromise;
}

import type { ProviderId } from '@byo-keys/core';

export const providerIds: ProviderId[] = ['anthropic', 'gemini', 'openrouter', 'ollama'];
