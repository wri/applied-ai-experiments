// =============================================================================
// Session telemetry store — a reactive, per-tab record of every LLM call.
// =============================================================================
//
// A module singleton (`sessionTelemetry`) that self-registers as a sink, so
// every runLLM call lands here automatically. Each running demo is its own
// SvelteKit bundle, so one singleton == one browser-tab "session". Cost is
// computed here at ingest (not in runLLM) from the model registry, keeping the
// run path free of pricing/model imports.
//
// Persistence is sessionStorage, keyed per demo slug (all demos share one
// origin on GitHub Pages, so a path-agnostic key would collide). Entries are
// trimmed before writing (long text truncated, base64 images dropped) and
// capped to a ring buffer.
//
// Energy & carbon are estimated *live* from each call's measured token usage and
// a reactive set of assumptions (EmissionFactors) held here — see
// ./energy-carbon. Changing an assumption (via the dashboard's control panel)
// recomputes every figure on the next read; nothing is baked in at ingest.
// =============================================================================

import type {
  TokenUsage,
  FinishReason,
  Message,
  ContentPart,
} from '@byo-keys/core';
import type { InspectableRequest } from '../types';
import { computeCost } from '../cost/cost';
import { getModel } from '../models';
import { registerTelemetrySink, type TelemetryRecord } from './sink';
import {
  estimateEnergyCarbon,
  mergeFactors,
  cloneDefaultFactors,
  type EmissionFactors,
  type FactorOverrides,
  type EnergyCarbonEstimate,
} from './energy-carbon';

// --- Public types ----------------------------------------------------------

/** Estimated energy use for a call. Populated by an enricher; empty until then. */
export interface EnergyMetrics {
  wattHours?: number;
}

/** Estimated emissions for a call. Populated by an enricher; empty until then. */
export interface CarbonMetrics {
  gramsCO2e?: number;
}

/** One recorded LLM call. */
export interface TelemetryEntry {
  id: string;
  /** Monotonic per-session sequence number, for stable ordering. */
  seq: number;
  request: InspectableRequest;
  usage?: TokenUsage;
  /** Actual cost from usage + registry pricing; null when pricing/usage unknown. */
  costUsd: number | null;
  latencyMs: number;
  finishReason?: FinishReason;
  error?: string;
  aborted?: boolean;
  recordedAt: number;
  energy?: EnergyMetrics;
  carbon?: CarbonMetrics;
}

/** Token totals broken out by type, every field guaranteed numeric. */
export interface UsageByType {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  thinkingTokens: number;
}

export interface GroupAggregate {
  calls: number;
  usage: UsageByType;
  costUsd: number;
  hasUnknownCost: boolean;
}

export interface TelemetryAggregates {
  totalCalls: number;
  errorCount: number;
  abortedCount: number;
  usageByType: UsageByType;
  /** Sum of known per-call costs. Approximate: prices input+output only. */
  totalCostUsd: number;
  /** True when any call's cost is unknown — UI should prefix totals with "≥". */
  hasUnknownCost: boolean;
  totalLatencyMs: number;
  avgLatencyMs: number;
  byModel: Record<string, GroupAggregate>;
  byProvider: Record<string, GroupAggregate>;
  /** True when energy estimation is on and at least one call has usage data. */
  hasEnergyData: boolean;
  /** Sum of estimated energy across calls, watt-hours (from the current assumptions). */
  totalWattHours: number;
  /** Sum of estimated emissions across calls, grams CO2e (from the current assumptions). */
  totalGramsCO2e: number;
}

/** Post-hoc enricher; returns energy/carbon to merge onto an entry. */
export type TelemetryEnricher = (
  entry: TelemetryEntry
) => Partial<Pick<TelemetryEntry, 'energy' | 'carbon'>> | undefined | void;

export interface SessionTelemetryStore {
  readonly entries: TelemetryEntry[];
  readonly aggregates: TelemetryAggregates;
  readonly paused: boolean;
  readonly persist: boolean;
  /** Current emission assumptions (reactive — edit via setFactors). */
  readonly factors: EmissionFactors;
  /** Whether energy/carbon estimation is active. */
  readonly energyEnabled: boolean;
  /** Sink entry point — also self-registered, so runLLM reaches it automatically. */
  recordCall(record: TelemetryRecord): void;
  /** Set the persistence key and rehydrate (idempotent; call once on mount). */
  configure(slug: string): void;
  clear(): void;
  setPaused(value: boolean): void;
  setPersist(value: boolean): void;
  /** Merge a partial override into the emission factors (triggers a live recompute). */
  setFactors(partial: FactorOverrides): void;
  /** Restore the default emission factors. */
  resetFactors(): void;
  setEnergyEnabled(value: boolean): void;
  /** Estimate energy/carbon for one entry under the current assumptions. */
  estimateFor(entry: TelemetryEntry): EnergyCarbonEstimate | null;
  exportJson(): unknown;
}

// --- Enricher registry (shared; future carbon/energy plugs in here) --------

const enrichers = new Set<TelemetryEnricher>();

/** Register an enricher run at ingest. Returns an unsubscribe function. */
export function registerTelemetryEnricher(fn: TelemetryEnricher): () => void {
  enrichers.add(fn);
  return () => {
    enrichers.delete(fn);
  };
}

// --- Tunables --------------------------------------------------------------

/** Ring-buffer cap. Plenty for a demo session; oldest drop off past this. */
const MAX_ENTRIES = 500;
/** Truncate long text in persisted entries to keep sessionStorage small. */
const MAX_PERSIST_TEXT = 600;
/** Debounce sessionStorage writes. */
const PERSIST_DEBOUNCE_MS = 400;

// --- Helpers ---------------------------------------------------------------

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `tel-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

function emptyUsageByType(): UsageByType {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    thinkingTokens: 0,
  };
}

function addUsage(acc: UsageByType, u: TokenUsage | undefined): void {
  if (!u) return;
  acc.inputTokens += u.inputTokens || 0;
  acc.outputTokens += u.outputTokens || 0;
  acc.totalTokens += u.totalTokens || 0;
  acc.cacheReadTokens += u.cacheReadTokens || 0;
  acc.cacheWriteTokens += u.cacheWriteTokens || 0;
  acc.thinkingTokens += u.thinkingTokens || 0;
}

function computeAggregates(
  entries: TelemetryEntry[],
  factors: EmissionFactors,
  energyEnabled: boolean
): TelemetryAggregates {
  const usageByType = emptyUsageByType();
  const byModel: Record<string, GroupAggregate> = {};
  const byProvider: Record<string, GroupAggregate> = {};
  let totalCostUsd = 0;
  let hasUnknownCost = false;
  let totalLatencyMs = 0;
  let errorCount = 0;
  let abortedCount = 0;
  let hasEnergyData = false;
  let totalWattHours = 0;
  let totalGramsCO2e = 0;

  const group = (
    table: Record<string, GroupAggregate>,
    key: string,
    entry: TelemetryEntry
  ): void => {
    const g = (table[key] ??= { calls: 0, usage: emptyUsageByType(), costUsd: 0, hasUnknownCost: false });
    g.calls += 1;
    addUsage(g.usage, entry.usage);
    if (entry.costUsd != null) g.costUsd += entry.costUsd;
    else g.hasUnknownCost = true;
  };

  for (const entry of entries) {
    addUsage(usageByType, entry.usage);
    if (entry.costUsd != null) totalCostUsd += entry.costUsd;
    else hasUnknownCost = true;
    totalLatencyMs += entry.latencyMs;
    if (entry.error) errorCount += 1;
    if (entry.aborted) abortedCount += 1;
    if (energyEnabled) {
      const est = estimateEnergyCarbon(entry.usage, entry.request.model, factors);
      if (est) {
        hasEnergyData = true;
        totalWattHours += est.wattHours;
        totalGramsCO2e += est.gramsCO2e;
      }
    }
    group(byModel, entry.request.model, entry);
    group(byProvider, entry.request.providerId, entry);
  }

  const totalCalls = entries.length;
  return {
    totalCalls,
    errorCount,
    abortedCount,
    usageByType,
    totalCostUsd,
    hasUnknownCost,
    totalLatencyMs,
    avgLatencyMs: totalCalls > 0 ? totalLatencyMs / totalCalls : 0,
    byModel,
    byProvider,
    hasEnergyData,
    totalWattHours,
    totalGramsCO2e,
  };
}

function trimText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value.length > MAX_PERSIST_TEXT
    ? `${value.slice(0, MAX_PERSIST_TEXT)}… [+${value.length - MAX_PERSIST_TEXT} chars]`
    : value;
}

function trimMessage(message: Message): Message {
  if (typeof message.content === 'string') {
    return { role: message.role, content: trimText(message.content) ?? '' };
  }
  const parts: ContentPart[] = message.content.map((part) => {
    if (part.type === 'text') return { type: 'text', text: trimText(part.text) ?? '' };
    if (part.type === 'thinking') return { type: 'thinking', thinking: trimText(part.thinking) ?? '' };
    // Drop heavy base64 image payloads; keep a placeholder so the shape survives.
    if (part.type === 'image' && part.source.type === 'base64') {
      return { type: 'image', source: { type: 'url', url: `[base64 ${part.source.mediaType} omitted]` } };
    }
    return part;
  });
  return { role: message.role, content: parts };
}

function trimEntryForStorage(entry: TelemetryEntry): TelemetryEntry {
  return {
    ...entry,
    request: {
      ...entry.request,
      system: trimText(entry.request.system),
      messages: entry.request.messages.map(trimMessage),
    },
  };
}

// --- Store factory ---------------------------------------------------------

export function createSessionTelemetry(): SessionTelemetryStore {
  const entries = $state<TelemetryEntry[]>([]);
  let paused = $state(false);
  let persistEnabled = $state(true);
  let factors = $state<EmissionFactors>(cloneDefaultFactors());
  let energyEnabled = $state(true);

  let seqCounter = 0;
  let storageKey: string | null = null;
  let configured = false;
  let persistTimer: ReturnType<typeof setTimeout> | null = null;

  function writePersist(): void {
    persistTimer = null;
    if (!persistEnabled || !storageKey || typeof window === 'undefined') return;
    try {
      const snapshot = $state.snapshot(entries) as TelemetryEntry[];
      const payload = {
        seq: seqCounter,
        entries: snapshot.map(trimEntryForStorage),
        // Persist the assumptions so a session's custom factors survive reload.
        factors: $state.snapshot(factors),
      };
      window.sessionStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Quota exceeded, storage disabled, or private mode — telemetry is
      // best-effort; the live in-memory view is unaffected.
    }
  }

  function schedulePersist(): void {
    if (!persistEnabled || !storageKey || typeof window === 'undefined') return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(writePersist, PERSIST_DEBOUNCE_MS);
  }

  function clearStorage(): void {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }

  function rehydrate(): void {
    if (!storageKey || typeof window === 'undefined' || entries.length > 0) return;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        seq?: number;
        entries?: TelemetryEntry[];
        factors?: FactorOverrides;
      };
      if (Array.isArray(parsed.entries) && parsed.entries.length > 0) {
        entries.push(...parsed.entries);
      }
      if (typeof parsed.seq === 'number') seqCounter = Math.max(seqCounter, parsed.seq);
      if (parsed.factors) factors = mergeFactors(factors, parsed.factors);
    } catch {
      // Corrupt payload — drop it rather than crash the demo.
      clearStorage();
    }
  }

  function recordCall(record: TelemetryRecord): void {
    if (paused) return;
    const model = getModel(record.request.model);
    const costUsd = record.usage ? computeCost(model, record.usage) : null;

    let entry: TelemetryEntry = {
      id: newId(),
      seq: ++seqCounter,
      request: record.request,
      usage: record.usage,
      costUsd,
      latencyMs: record.latencyMs,
      finishReason: record.finishReason,
      error: record.error,
      aborted: record.aborted,
      recordedAt: Date.now(),
    };

    for (const enrich of enrichers) {
      try {
        const extra = enrich(entry);
        if (extra) entry = { ...entry, ...extra };
      } catch {
        // An enricher must never break ingestion.
      }
    }

    entries.push(entry);
    if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
    schedulePersist();
  }

  function configure(slug: string): void {
    if (configured) return;
    configured = true;
    if (typeof window === 'undefined') return;
    storageKey = `wri-llm-telemetry:${slug}`;
    if (persistEnabled) rehydrate();
  }

  function clear(): void {
    entries.splice(0, entries.length);
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    clearStorage();
  }

  function setPaused(value: boolean): void {
    paused = value;
  }

  function setPersist(value: boolean): void {
    persistEnabled = value;
    if (!value) clearStorage();
    else schedulePersist();
  }

  function setFactors(partial: FactorOverrides): void {
    factors = mergeFactors(factors, partial);
    schedulePersist();
  }

  function resetFactors(): void {
    factors = cloneDefaultFactors();
    schedulePersist();
  }

  function setEnergyEnabled(value: boolean): void {
    energyEnabled = value;
    schedulePersist();
  }

  function estimateFor(entry: TelemetryEntry): EnergyCarbonEstimate | null {
    return energyEnabled
      ? estimateEnergyCarbon(entry.usage, entry.request.model, factors)
      : null;
  }

  function exportJson(): unknown {
    const snapshot = $state.snapshot(entries) as TelemetryEntry[];
    return {
      exportedAt: Date.now(),
      factors: $state.snapshot(factors),
      energyEnabled,
      entries: snapshot.map((e) => {
        const est = estimateFor(e);
        return est
          ? { ...e, energy: { wattHours: est.wattHours }, carbon: { gramsCO2e: est.gramsCO2e } }
          : e;
      }),
    };
  }

  // Activate the runLLM tap for this store.
  registerTelemetrySink(recordCall);

  return {
    get entries() {
      return entries;
    },
    get aggregates() {
      return computeAggregates(entries, factors, energyEnabled);
    },
    get paused() {
      return paused;
    },
    get persist() {
      return persistEnabled;
    },
    get factors() {
      return factors;
    },
    get energyEnabled() {
      return energyEnabled;
    },
    recordCall,
    configure,
    clear,
    setPaused,
    setPersist,
    setFactors,
    resetFactors,
    setEnergyEnabled,
    estimateFor,
    exportJson,
  };
}

/** The per-tab session telemetry singleton. */
export const sessionTelemetry: SessionTelemetryStore = createSessionTelemetry();
