// =============================================================================
// Per-request mocks — deterministic keyless mode for demos.
// =============================================================================
//
// The second keyless mechanism alongside ./replay. The difference is what they
// can cover:
//
//   replay — plays a REAL recorded session back. Faithful usage/latency/cost,
//            but fixed: it can only reproduce the one journey that was recorded.
//   mock   — resolves each call from a spec the demo supplies at the call site.
//            Handles arbitrary interactive input, but the content is synthetic,
//            so it reports NO usage and therefore no cost. Never invent tokens.
//
// Precedence in runLLM: an active replay session wins (real data beats
// synthetic), then a mock spec, then the live network path.
//
// The load-bearing property, borrowed from the ai-web-map-exploration
// experiment that proved this pattern: a mock resolves to a STRING that then
// travels the demo's normal path. JSON fixtures go through the same
// parseStructured/validate/repair the live path uses, so a fixture that would
// fail the schema fails in mock too — fixtures can't silently drift from the
// contract they claim to demonstrate.
//
// Module singleton, mirroring ./replay/replay.svelte.ts: one demo bundle == one
// tab == one controller. `forceMock` is reactive so a demo can badge its header
// and lock inputs while mock mode is on.
// =============================================================================

import { get } from 'svelte/store';
import type { BYOKStores } from '@byo-keys/svelte';
import type { ProviderId } from '@byo-keys/core';
import type { InspectableRequest } from '../types';
// Type-only — erased at runtime, so no import cycle with run-llm.
import type { RunLLMOptions, RunLLMResult } from '../run/run-llm';

// --- Public types ----------------------------------------------------------

/**
 * How one call behaves with no key. `match` picks a canned response by pattern
 * against the last user text (the usual choice when the demo has a handful of
 * sample inputs); `fn` computes one, for repair-turn fixtures or composed
 * templates.
 */
export type MockSpec =
  | { kind: 'text'; text: string }
  | { kind: 'json'; value: unknown }
  | { kind: 'match'; cases: { pattern: RegExp; text: string }[]; fallback: string }
  | { kind: 'fn'; run: (request: InspectableRequest) => string | Promise<string> };

// --- Streaming simulation tunables -----------------------------------------

const THINK_MS = 350; // initial pause, so async states are exercised
const MIN_CHUNK_MS = 14;
const MAX_CHUNK_MS = 40;
// Total streaming budget, mirroring replayRun's MIN/MAX_PLAYBACK_MS. Without a
// ceiling, a large fixture (a 10-node graph, a long extraction) streams for tens
// of seconds at the per-chunk rate — so for big fixtures the per-chunk delay
// scales down rather than the wait scaling up.
const MAX_PLAYBACK_MS = 4000;

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    });
  });
}

/** The last user-authored text in a request — what `match` specs test against. */
export function lastUserText(request: InspectableRequest): string {
  for (let i = request.messages.length - 1; i >= 0; i--) {
    const m = request.messages[i];
    if (m.role !== 'user') continue;
    if (typeof m.content === 'string') return m.content;
    const parts = m.content.filter((p) => p.type === 'text') as Array<{ text: string }>;
    if (parts.length) return parts.map((p) => p.text).join('\n');
  }
  return '';
}

/** Resolve a spec to the raw model-facing string it stands in for. */
export async function resolveMock(spec: MockSpec, request: InspectableRequest): Promise<string> {
  switch (spec.kind) {
    case 'text':
      return spec.text;
    // Fenced, because that's what a real model emits when asked for JSON — so
    // the demo's extractor is exercised rather than bypassed.
    case 'json':
      return '```json\n' + JSON.stringify(spec.value, null, 2) + '\n```';
    case 'match': {
      const text = lastUserText(request).toLowerCase();
      for (const c of spec.cases) {
        if (c.pattern.test(text)) return c.text;
      }
      return spec.fallback;
    }
    case 'fn':
      return await spec.run(request);
  }
}

// --- Force-mock control (module singleton) ---------------------------------

let forceMock = $state(false);

/**
 * Force mock mode even when a key is present. Useful for demoing live on stage
 * (deterministic and free) and for showing the keyless path to someone who has
 * a key saved.
 */
export function setForceMock(v: boolean): void {
  forceMock = v;
}

/** Reactive — read inside effects/derived to track. */
export function isForceMock(): boolean {
  return forceMock;
}

/**
 * Can this provider actually make a live call right now? A key-required provider
 * needs a valid key; a keyless provider (e.g. Ollama) counts only if models were
 * actually discovered, so registered-but-unreachable still falls back to mock.
 *
 * Mirrors the check in ReplayBanner, deliberately: the two keyless mechanisms
 * must agree on what "no key" means.
 */
export function canRunLive(stores: BYOKStores, providerId: ProviderId): boolean {
  try {
    const providers = get(stores.providers);
    const keys = get(stores.keys) as Partial<Record<ProviderId, { hasKey?: boolean; isValid?: boolean; models?: unknown[] }>>;
    const provider = providers.find((p) => p.config.id === providerId);
    const status = keys[providerId];
    if (!provider) return status?.hasKey === true && status?.isValid === true;
    if (provider.config.requiresKey) return status?.hasKey === true && status?.isValid === true;
    return (status?.models?.length ?? 0) > 0;
  } catch {
    // Stores not initialised yet — treat as "can't run live" so a mock spec wins.
    return false;
  }
}

/** True when runLLM should resolve this call from `opts.mock`. */
export function shouldMock(
  stores: BYOKStores,
  providerId: ProviderId,
  hasSpec: boolean
): boolean {
  if (!hasSpec) return false;
  return forceMock || !canRunLive(stores, providerId);
}

// --- The run path ----------------------------------------------------------

/**
 * The mock counterpart to a live runLLM call: resolve the spec, stream it
 * through opts.onDelta with simulated typing (honoring opts.signal), and return
 * a RunLLMResult carrying **no usage** — a mock call cost nothing, and
 * fabricating tokens would put invented numbers in the cost column and the
 * telemetry dashboard. `mocked: true` lets the UI label the run.
 */
export async function mockRun(
  spec: MockSpec,
  request: InspectableRequest,
  opts: RunLLMOptions
): Promise<RunLLMResult> {
  const started = performance.now();

  let full: string;
  try {
    full = await resolveMock(spec, request);
  } catch (err) {
    return {
      content: '',
      latencyMs: performance.now() - started,
      error: err instanceof Error ? err.message : 'Mock resolution failed',
      mocked: true,
      request,
    };
  }

  await delay(THINK_MS, opts.signal);

  // Word-chunks rather than fixed slices, so the streaming cadence looks like a
  // model rather than a progress bar.
  const chunks = full.match(/\S+\s*/g) ?? [];
  // Per-chunk delay, capped so total playback stays inside the budget.
  const perChunkMs =
    chunks.length > 0
      ? Math.min(MIN_CHUNK_MS + Math.random() * (MAX_CHUNK_MS - MIN_CHUNK_MS), MAX_PLAYBACK_MS / chunks.length)
      : 0;
  let acc = '';
  for (const chunk of chunks) {
    if (opts.signal?.aborted) {
      return {
        content: acc,
        latencyMs: performance.now() - started,
        error: 'Cancelled',
        aborted: true,
        mocked: true,
        request,
      };
    }
    acc += chunk;
    opts.onDelta?.(chunk, acc);
    if (perChunkMs > 0) await delay(perChunkMs, opts.signal);
  }

  return {
    content: full,
    // No `usage` — see above. Cost helpers return null for unknown usage, so the
    // dashboard and any cost column read as "no spend" rather than a made-up figure.
    latencyMs: performance.now() - started,
    finishReason: 'stop',
    mocked: true,
    request,
  };
}

// --- Reactive header mode --------------------------------------------------

/**
 * The reactive `'mock' | 'live'` a demo header badge needs.
 *
 * `canRunLive`/`shouldMock` above read the BYOK stores with `get()`, which is
 * correct at call time but registers no reactive dependency — a `$derived` over
 * them would never notice a key being saved. This wraps them so the badge
 * updates the moment keys or providers change, and so all six BYOK demos share
 * one implementation instead of hand-rolling the subscription each.
 *
 * Call it during component init (it opens an `$effect`):
 *
 *     const demoMode = createDemoMode(stores, () => providerId, () => modelId);
 *     <DemoLayout mode={demoMode.mode} modeLabel={demoMode.label} … />
 */
export function createDemoMode(
  stores: BYOKStores,
  getProviderId: () => ProviderId,
  getModelId?: () => string | undefined
): { readonly mode: 'mock' | 'live'; readonly label: string } {
  let live = $state(false);

  $effect(() => {
    // Re-subscribes whenever the demo switches provider.
    const providerId = getProviderId();
    const recompute = () => {
      live = canRunLive(stores, providerId);
    };
    const unsubKeys = stores.keys.subscribe(recompute);
    const unsubProviders = stores.providers.subscribe(recompute);
    return () => {
      unsubKeys();
      unsubProviders();
    };
  });

  return {
    get mode() {
      return !forceMock && live ? 'live' : 'mock';
    },
    get label() {
      if (forceMock || !live) return 'mock';
      // Prefer the friendly registry name; fall back to the raw id, then the
      // provider, so the badge is never empty.
      const modelId = getModelId?.();
      if (modelId) return shortModelLabel(modelId);
      return getProviderId();
    },
  };
}

/**
 * A model id trimmed to fit header chrome: drop the trailing date stamp, which
 * is the longest and least informative part (`claude-sonnet-4-6-20260214` →
 * `claude-sonnet-4-6`). Deliberately not a registry lookup — this module is in
 * run-llm's import graph and the registry has no business being pulled in here.
 */
function shortModelLabel(modelId: string): string {
  return modelId.replace(/-\d{8}$/, '');
}
