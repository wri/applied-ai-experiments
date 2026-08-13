import type { BYOKStores } from '@byo-keys/svelte';
import type { ProviderId, Message, TokenUsage, FinishReason } from '@byo-keys/core';
import type { InspectableRequest } from '../types';
import { emitTelemetry } from '../telemetry/sink';
import { isReplayActive, replayRun } from '../replay/replay.svelte';
import { mockRun, shouldMock, type MockSpec } from '../mock/mock.svelte';

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
   * What this call does with no key. When supplied and the provider can't make a
   * live call (or force-mock is on), the call resolves from this spec instead of
   * the network — see ../mock/mock.svelte. Mock results carry no usage, so they
   * never contribute a fabricated cost.
   */
  mock?: MockSpec;
  /**
   * Cooperative cancellation: byo-keys streams don't accept a signal, so
   * abort stops consuming the stream (which closes the underlying reader).
   */
  signal?: AbortSignal;
  onDelta?: (delta: string, full: string) => void;
  /**
   * Record this call to session telemetry (the dev-view dashboard). Default
   * true. Set false for internal/preflight calls that shouldn't be surfaced.
   */
  telemetry?: boolean;
}

export interface RunLLMResult {
  content: string;
  usage?: TokenUsage;
  latencyMs: number;
  finishReason?: FinishReason;
  /** Set when the call failed or was aborted; content holds whatever streamed */
  error?: string;
  aborted?: boolean;
  /** True when this call was resolved from a MockSpec rather than the network. */
  mocked?: boolean;
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

  // Emit to session telemetry exactly once, on whichever path we return from,
  // so aborted/errored calls are recorded without double-counting. Tap only
  // here — createLLMRun and fanOut both route through runLLM.
  function finish(result: RunLLMResult): RunLLMResult {
    if (opts.telemetry !== false) {
      emitTelemetry({
        request: result.request,
        usage: result.usage,
        latencyMs: result.latencyMs,
        finishReason: result.finishReason,
        error: result.error,
        aborted: result.aborted,
      });
    }
    return result;
  }

  const started = performance.now();
  let content = '';
  let usage: TokenUsage | undefined;
  let finishReason: FinishReason | undefined;
  let error: string | undefined;
  let aborted = false;

  if (opts.signal?.aborted) {
    return finish({
      content,
      latencyMs: 0,
      error: 'Aborted before start',
      aborted: true,
      request,
    });
  }

  // Replay mode: resolve this call from a recorded session instead of the
  // network. Still routed through finish() so it lands in session telemetry
  // exactly like a live call. Live path below is untouched.
  if (isReplayActive()) {
    return finish(await replayRun(request, opts));
  }

  // Mock mode: resolve from the call's own MockSpec when this provider can't make
  // a live call (or force-mock is on). Ranked below replay because replay carries
  // real recorded usage while a mock carries none. Also routed through finish(),
  // so a keyless session still lists every call in the telemetry dashboard — at
  // $0, because a mock call spent nothing.
  if (shouldMock(stores, opts.providerId, opts.mock !== undefined)) {
    return finish(await mockRun(opts.mock as MockSpec, request, opts));
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
        case 'usage': {
          // Merge, don't overwrite: providers may send usage across several
          // chunks (e.g. Anthropic emits input/cache at message_start and
          // output later), so accumulate rather than clobber.
          const u = chunk.usage;
          const merged: TokenUsage = {
            inputTokens: u.inputTokens ?? usage?.inputTokens ?? 0,
            outputTokens: u.outputTokens ?? usage?.outputTokens ?? 0,
            totalTokens: 0,
            cacheReadTokens: u.cacheReadTokens ?? usage?.cacheReadTokens,
            cacheWriteTokens: u.cacheWriteTokens ?? usage?.cacheWriteTokens,
            thinkingTokens: u.thinkingTokens ?? usage?.thinkingTokens,
          };
          merged.totalTokens = u.totalTokens ?? merged.inputTokens + merged.outputTokens;
          usage = merged;
          break;
        }
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

  return finish({
    content,
    usage,
    latencyMs: performance.now() - started,
    finishReason,
    error,
    aborted,
    request,
  });
}
