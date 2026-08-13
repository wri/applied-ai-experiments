// =============================================================================
// Session replay — play a recorded LLM session back through the normal run path.
// =============================================================================
//
// When a recorded ReplaySession is active, runLLM resolves each call from the
// recording instead of hitting the network (see ../run/run-llm). Because the
// replayed content is byte-identical to what was recorded, any content-dependent
// branching in a demo (parse → repair, validation, analysis) re-derives the same
// sequence of calls — so demos run their *normal* flow with no per-demo adapters.
//
// This is the keyless-visitor fallback: a maintainer records a real session, the
// fixture is committed, and visitors without an API key watch it play out.
//
// Module singleton, mirroring ./telemetry/session-telemetry.svelte.ts: one demo
// bundle == one tab == one controller. `active` is reactive so the ReplayBanner
// and demo pages can lock inputs / swap button labels while replay is running.
// =============================================================================

import type { InspectableRequest, RunResponse } from '../types';
// Type-only imports — erased at runtime, so no import cycle with run-llm.
import type { RunLLMOptions, RunLLMResult } from '../run/run-llm';

// --- Public types ----------------------------------------------------------

/** One recorded request/response pair, matched on replay by `label`. */
export interface ReplayCall {
  /** Stable label for matching (e.g. "variant:rubric", "run 3"); mirrors request.label. */
  label?: string;
  request: InspectableRequest;
  response: RunResponse;
}

/** A recorded session committed alongside a demo and played back to keyless visitors. */
export interface ReplaySession {
  /** Experiment slug, e.g. 'prompt-comparator'. */
  experiment: string;
  title?: string;
  description?: string;
  /** Epoch ms when the session was recorded. */
  recordedAt: number;
  /** Demo-owned input blob, restored before playback (same shape as RunRecord.config). */
  config: Record<string, unknown>;
  calls: ReplayCall[];
}

// --- Streaming simulation tunables -----------------------------------------

const DELTA_CHARS = 30; // characters streamed per simulated chunk
const MIN_PLAYBACK_MS = 600; // floor so very fast calls still "type out"
const MAX_PLAYBACK_MS = 4000; // ceiling so very slow calls don't drag

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function callLabel(call: ReplayCall): string | undefined {
  return call.label ?? call.request.label;
}

// --- Controller (module singleton) -----------------------------------------

let active = $state<ReplaySession | null>(null);
/** Parallel to active.calls — which entries have already been replayed this run. */
let consumed: boolean[] = [];

/** Begin replay: make the session active and reset the consumption cursor. */
export function activateReplay(session: ReplaySession): void {
  active = session;
  consumed = session.calls.map(() => false);
}

/** End replay and return the demo to live mode. */
export function deactivateReplay(): void {
  active = null;
  consumed = [];
}

/** Reset the cursor so the same session can be replayed again from the top. */
export function resetReplayCursor(): void {
  if (active) consumed = active.calls.map(() => false);
}

/** True when a recorded session is active and runLLM should resolve from it. */
export function isReplayActive(): boolean {
  return active !== null;
}

/** The active session, or null. Reactive — read it inside effects/derived to track. */
export function getActiveSession(): ReplaySession | null {
  return active;
}

/**
 * Pick the recorded call for an outgoing request and mark it consumed.
 *   1. first unconsumed call whose label matches (primary path)
 *   2. else the next unconsumed call in recorded order (unlabeled fallback)
 * Synchronous, so it stays atomic under fanOut concurrency. Returns null when
 * the recording is exhausted.
 */
function matchCall(label: string | undefined): ReplayCall | null {
  if (!active) return null;
  const calls = active.calls;
  if (label != null) {
    for (let i = 0; i < calls.length; i++) {
      if (!consumed[i] && callLabel(calls[i]) === label) {
        consumed[i] = true;
        return calls[i];
      }
    }
  }
  for (let i = 0; i < calls.length; i++) {
    if (!consumed[i]) {
      consumed[i] = true;
      return calls[i];
    }
  }
  return null;
}

/**
 * The replay counterpart to a live runLLM call: resolve the recorded response,
 * stream it through opts.onDelta with simulated typing (honoring opts.signal),
 * and return a RunLLMResult that preserves the recorded usage / finishReason /
 * latency so telemetry and cost stay faithful.
 */
export async function replayRun(
  request: InspectableRequest,
  opts: RunLLMOptions
): Promise<RunLLMResult> {
  const started = performance.now();
  const call = matchCall(opts.label);

  if (!call) {
    return {
      content: '',
      latencyMs: 0,
      error: `No recorded response for "${opts.label ?? 'call'}"`,
      request,
    };
  }

  const resp = call.response;
  const full = resp.content ?? '';

  const chunks: string[] = [];
  for (let i = 0; i < full.length; i += DELTA_CHARS) {
    chunks.push(full.slice(i, i + DELTA_CHARS));
  }
  const totalMs = Math.min(Math.max(resp.latencyMs || 0, MIN_PLAYBACK_MS), MAX_PLAYBACK_MS);
  const perChunkMs = chunks.length > 0 ? totalMs / chunks.length : 0;

  let acc = '';
  for (const chunk of chunks) {
    if (opts.signal?.aborted) {
      return {
        content: acc,
        usage: resp.usage,
        latencyMs: performance.now() - started,
        error: 'Cancelled',
        aborted: true,
        request,
      };
    }
    acc += chunk;
    opts.onDelta?.(chunk, acc);
    if (perChunkMs > 0) await delay(perChunkMs);
  }

  return {
    content: full,
    usage: resp.usage,
    // Recorded latency for fidelity; fall back to measured playback time.
    latencyMs: resp.latencyMs || performance.now() - started,
    finishReason: resp.finishReason,
    error: resp.error,
    request,
  };
}
