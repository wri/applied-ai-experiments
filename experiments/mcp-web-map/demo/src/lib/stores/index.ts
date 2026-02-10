import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { createBYOKClient, createStorage } from '@byo-keys/core';
import { createBYOKStores, type BYOKStores } from '@byo-keys/svelte';
import { anthropic, gemini, openrouter } from '@byo-keys/providers';

// Create BYOK client with supported providers
const client = createBYOKClient({
  providers: [
    anthropic({ dangerouslyAllowBrowser: true }),
    gemini(),
    openrouter(),
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
    })
    .catch((error) => {
      console.error('Failed to initialize BYOK stores:', error);
      storesReady.set(true);
    });

  return initPromise;
}

import type { ProviderId } from '@byo-keys/core';

export const providerIds: ProviderId[] = ['anthropic', 'gemini', 'openrouter'];
