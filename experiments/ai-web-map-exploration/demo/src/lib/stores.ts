import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { createBYOKClient, createStorage } from '@byo-keys/core';
import { createBYOKStores, type BYOKStores } from '@byo-keys/svelte';
import { anthropic, ollama, isLoopbackOrigin } from '@byo-keys/providers';
import { SLUG } from './slug';

// The app is Anthropic-first (all demos target Claude models). Ollama is offered
// as an optional keyless local provider; its models are auto-discovered if the
// local server is reachable.
const client = createBYOKClient({
	providers: [anthropic({ dangerouslyAllowBrowser: true }), ollama()],
	storage: browser
		? createStorage({ backend: 'localStorage', prefix: SLUG })
		: createStorage({ backend: 'memory' }),
	autoValidate: false,
});

export const stores: BYOKStores = createBYOKStores(client);

export const storesReady = writable(false);

let initPromise: Promise<void> | null = null;

export function initStores(): Promise<void> {
	if (!browser) return Promise.resolve();
	if (initPromise) return initPromise;

	initPromise = stores
		.initialize()
		.catch((error) => {
			console.error('Failed to initialize BYOK stores:', error);
		})
		.then(() => {
			storesReady.set(true);
			// Auto-discover locally-pulled Ollama models. Only worth attempting from a
			// loopback origin: on a deployed https:// page the request to
			// localhost:11434 cannot succeed and only logs a CORS error.
			if (isLoopbackOrigin()) stores.refreshModels('ollama').catch(() => {});
		});

	return initPromise;
}
