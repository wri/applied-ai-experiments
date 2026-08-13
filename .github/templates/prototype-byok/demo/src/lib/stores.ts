import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { createBYOKClient, createStorage } from '@byo-keys/core';
import { createBYOKStores, type BYOKStores } from '@byo-keys/svelte';
import { anthropic, openai, gemini, openrouter, huggingface, ollama } from '@byo-keys/providers';
import { SLUG } from './slug';

// One BYOK client wired with every provider the design system supports. Keys
// live in the browser (localStorage), namespaced by slug, and never touch a
// server — that's the "bring your own key" contract. Trim the provider list
// below to the ones your demo actually needs.
const client = createBYOKClient({
	providers: [
		anthropic({ dangerouslyAllowBrowser: true }),
		openai(),
		gemini(),
		openrouter({ siteName: SLUG }),
		huggingface(),
		ollama()
	],
	storage: browser
		? createStorage({ backend: 'localStorage', prefix: SLUG })
		: createStorage({ backend: 'memory' }),
	autoValidate: false
});

export const stores: BYOKStores = createBYOKStores(client);

export const storesReady = writable(false);

let initPromise: Promise<void> | null = null;

/** Initialize BYOK stores once on the client; safe to call repeatedly. */
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
			// Auto-discover locally-pulled Ollama models, if the server is reachable.
			stores.refreshModels('ollama').catch(() => {});
		});

	return initPromise;
}
