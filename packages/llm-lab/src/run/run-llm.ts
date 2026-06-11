import type { BYOKStores } from '@byo-keys/svelte';
import type { ProviderId, Message, TokenUsage, FinishReason } from '@byo-keys/core';
import type { InspectableRequest } from '../types';

export interface RunLLMOptions {
  providerId: ProviderId;
  model: string;
  messages: Message[];
  system?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  /** Recorded on the InspectableRequest for the inspector; not sent to the API */
  schema?: Record<string, unknown>;
  label?: string;
  /**
   * Cooperative cancellation: byo-keys streams don't accept a signal, so
   * abort stops consuming the stream (which closes the underlying reader).
   */
  signal?: AbortSignal;
  onDelta?: (delta: string, full: string) => void;
}

export interface RunLLMResult {
  content: string;
  usage?: TokenUsage;
  latencyMs: number;
  finishReason?: FinishReason;
  /** Set when the call failed or was aborted; content holds whatever streamed */
  error?: string;
  aborted?: boolean;
  request: InspectableRequest;
}

/**
 * Run one streaming LLM call and collect content, usage, latency, and an
 * InspectableRequest ready for the RequestInspector / run history.
 */
export async function runLLM(stores: BYOKStores, opts: RunLLMOptions): Promise<RunLLMResult> {
  const request: InspectableRequest = {
    providerId: opts.providerId,
    model: opts.model,
    system: opts.system,
    messages: opts.messages,
    params: {
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
      topP: opts.topP,
      topK: opts.topK,
    },
    schema: opts.schema,
    label: opts.label,
    sentAt: Date.now(),
  };

  const started = performance.now();
  let content = '';
  let usage: TokenUsage | undefined;
  let finishReason: FinishReason | undefined;
  let error: string | undefined;
  let aborted = false;

  if (opts.signal?.aborted) {
    return {
      content,
      latencyMs: 0,
      error: 'Aborted before start',
      aborted: true,
      request,
    };
  }

  try {
    const stream = stores.chatStream(opts.providerId, {
      model: opts.model,
      system: opts.system,
      messages: opts.messages,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens ?? 2048,
      topP: opts.topP,
      topK: opts.topK,
    });

    for await (const chunk of stream) {
      if (opts.signal?.aborted) {
        aborted = true;
        break;
      }
      switch (chunk.type) {
        case 'delta':
          content += chunk.content;
          opts.onDelta?.(chunk.content, content);
          break;
        case 'usage':
          usage = {
            inputTokens: chunk.usage.inputTokens ?? 0,
            outputTokens: chunk.usage.outputTokens ?? 0,
            totalTokens:
              chunk.usage.totalTokens ??
              (chunk.usage.inputTokens ?? 0) + (chunk.usage.outputTokens ?? 0),
          };
          break;
        case 'done':
          finishReason = chunk.finishReason;
          break;
        case 'error':
          error = chunk.error.message;
          break;
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error';
  }

  if (aborted && !error) {
    error = 'Cancelled';
  }

  return {
    content,
    usage,
    latencyMs: performance.now() - started,
    finishReason,
    error,
    aborted,
    request,
  };
}
