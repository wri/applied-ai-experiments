// =============================================================================
// Telemetry sink — a tiny, framework-free dispatcher between runLLM and any
// telemetry store(s) that want to observe LLM calls.
// =============================================================================
//
// runLLM imports only this module (plain TS, no Svelte). The session store
// (a .svelte.ts) registers itself as a sink on first import, so mounting the
// <SessionTelemetry/> component is what activates the tap. When no sink is
// registered (e.g. a demo that never mounts the dashboard, or a unit test),
// emitTelemetry is a cheap no-op and the store + component tree-shake away.
// =============================================================================

import type { TokenUsage, FinishReason } from '@byo-keys/core';
import type { InspectableRequest } from '../types';

/** Raw record emitted by runLLM for one settled call — no derived/cost fields yet. */
export interface TelemetryRecord {
  request: InspectableRequest;
  usage?: TokenUsage;
  latencyMs: number;
  finishReason?: FinishReason;
  /** Set when the call failed or was aborted */
  error?: string;
  aborted?: boolean;
}

export type TelemetrySink = (record: TelemetryRecord) => void;

const sinks = new Set<TelemetrySink>();

/** Register a sink. Returns an unsubscribe function. */
export function registerTelemetrySink(sink: TelemetrySink): () => void {
  sinks.add(sink);
  return () => {
    sinks.delete(sink);
  };
}

/** Fan a record out to every registered sink. No-op (and cheap) when none. */
export function emitTelemetry(record: TelemetryRecord): void {
  if (sinks.size === 0) return;
  for (const sink of sinks) {
    try {
      sink(record);
    } catch {
      // A misbehaving sink must never break the run path.
    }
  }
}
