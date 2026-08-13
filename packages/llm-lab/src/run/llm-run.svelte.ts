import type { BYOKStores } from '@byo-keys/svelte';
import type { TokenUsage } from '@byo-keys/core';
import type { InspectableRequest } from '../types';
import { runLLM, type RunLLMOptions, type RunLLMResult } from './run-llm';

export interface LLMRun {
  readonly content: string;
  readonly isStreaming: boolean;
  readonly error: string | null;
  readonly latencyMs: number;
  readonly usage: TokenUsage | null;
  readonly request: InspectableRequest | null;
  run(opts: Omit<RunLLMOptions, 'signal'>): Promise<RunLLMResult>;
  abort(): void;
  reset(): void;
}

/**
 * Runes wrapper around runLLM for streaming UIs: one reactive call slot
 * with content/isStreaming/error/usage state and abort support.
 */
export function createLLMRun(stores: BYOKStores): LLMRun {
  let content = $state('');
  let isStreaming = $state(false);
  let error = $state<string | null>(null);
  let latencyMs = $state(0);
  let usage = $state<TokenUsage | null>(null);
  let request = $state<InspectableRequest | null>(null);

  let controller: AbortController | null = null;
  let runToken = 0;

  function reset(): void {
    controller?.abort();
    controller = null;
    content = '';
    isStreaming = false;
    error = null;
    latencyMs = 0;
    usage = null;
    request = null;
  }

  async function run(opts: Omit<RunLLMOptions, 'signal'>): Promise<RunLLMResult> {
    reset();
    const token = ++runToken;
    controller = new AbortController();
    isStreaming = true;

    const result = await runLLM(stores, {
      ...opts,
      signal: controller.signal,
      onDelta: (delta, full) => {
        if (token === runToken) {
          content = full;
        }
        opts.onDelta?.(delta, full);
      },
    });

    if (token === runToken) {
      content = result.content;
      isStreaming = false;
      error = result.error ?? null;
      latencyMs = result.latencyMs;
      usage = result.usage ?? null;
      request = result.request;
    }
    return result;
  }

  function abort(): void {
    controller?.abort();
    isStreaming = false;
  }

  return {
    get content() {
      return content;
    },
    get isStreaming() {
      return isStreaming;
    },
    get error() {
      return error;
    },
    get latencyMs() {
      return latencyMs;
    },
    get usage() {
      return usage;
    },
    get request() {
      return request;
    },
    run,
    abort,
    reset,
  };
}
