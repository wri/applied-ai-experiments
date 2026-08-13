/**
 * Live LLM client, backed by the shared packages: `runLLM` (@wri-datalab/llm-lab)
 * over the BYOK stores (@byo-keys). runLLM handles streaming, usage/latency, the
 * request inspector, session telemetry, and replay — so this file is just the
 * adapter from the app's `LlmClient` interface onto runLLM.
 *
 * The app's `mock` field is ignored here (only the mock client reads it); keeping
 * it on the request lets a demo flip between live and mock with no code change.
 */

import { runLLM } from '@wri-datalab/llm-lab';
import type { BYOKStores } from '@byo-keys/svelte';
import { DEFAULT_MODEL, LlmError, toByoMessages, type LlmClient, type LlmRequest, type StreamEvent } from './types';

export function createLiveClient(stores: BYOKStores): LlmClient {
	return {
		id: 'anthropic',

		async *stream(req: LlmRequest, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
			// Bridge runLLM's onDelta callback into an async generator. A tiny queue
			// buffers deltas; the loop drains it and parks until the next delta or
			// the run settling (done/error).
			const queue: StreamEvent[] = [];
			let ended = false;
			let wake: (() => void) | null = null;
			const push = (ev: StreamEvent) => {
				queue.push(ev);
				const w = wake;
				wake = null;
				w?.();
			};

			runLLM(stores, {
				providerId: 'anthropic',
				model: req.model ?? DEFAULT_MODEL,
				system: req.system,
				messages: toByoMessages(req.messages),
				maxTokens: req.maxTokens,
				temperature: req.temperature,
				signal,
				onDelta: (delta) => push({ type: 'delta', text: delta })
			})
				.then((res) => {
					if (res.error && !res.content) {
						push({ type: 'error', message: res.error });
					} else {
						push({
							type: 'done',
							usage: res.usage
								? { inputTokens: res.usage.inputTokens, outputTokens: res.usage.outputTokens }
								: undefined
						});
					}
					ended = true;
					const w = wake;
					wake = null;
					w?.();
				})
				.catch((e) => {
					push({ type: 'error', message: e instanceof Error ? e.message : 'Stream error' });
					ended = true;
					const w = wake;
					wake = null;
					w?.();
				});

			while (true) {
				if (queue.length) {
					yield queue.shift()!;
					continue;
				}
				if (ended) return;
				await new Promise<void>((resolve) => {
					wake = resolve;
				});
			}
		},

		async complete(req: LlmRequest, signal?: AbortSignal): Promise<string> {
			const res = await runLLM(stores, {
				providerId: 'anthropic',
				model: req.model ?? DEFAULT_MODEL,
				system: req.system,
				messages: toByoMessages(req.messages),
				maxTokens: req.maxTokens,
				temperature: req.temperature,
				signal
			});
			if (res.error && !res.content) {
				throw new LlmError(res.error, undefined, 'other');
			}
			return res.content;
		}
	};
}
