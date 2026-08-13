/**
 * Reactive streaming-run wrapper (shaped like the monorepo's createLLMRun):
 * one in-flight run with reactive content / isStreaming / error and abort.
 */

import { llm } from './provider.svelte';
import type { LlmRequest } from './types';

export class LlmRun {
	content = $state('');
	isStreaming = $state(false);
	error = $state<string | null>(null);
	usage = $state<{ inputTokens: number; outputTokens: number } | null>(null);

	private controller: AbortController | null = null;

	async run(req: LlmRequest): Promise<string> {
		this.abort();
		const controller = new AbortController();
		this.controller = controller;
		this.content = '';
		this.error = null;
		this.usage = null;
		this.isStreaming = true;
		try {
			for await (const event of llm.stream(req, controller.signal)) {
				if (event.type === 'delta') this.content += event.text;
				else if (event.type === 'done') this.usage = event.usage ?? null;
				else if (event.type === 'error') this.error = event.message;
			}
		} catch (e) {
			if (!(e instanceof DOMException && e.name === 'AbortError')) {
				this.error = (e as Error).message;
			}
		} finally {
			if (this.controller === controller) {
				this.isStreaming = false;
				this.controller = null;
			}
		}
		return this.content;
	}

	abort() {
		this.controller?.abort();
		this.controller = null;
		this.isStreaming = false;
	}

	reset() {
		this.abort();
		this.content = '';
		this.error = null;
		this.usage = null;
	}
}
