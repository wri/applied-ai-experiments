// =============================================================================
// Energy & carbon model — pure math turning token usage into estimated
// electricity (Wh) and emissions (gCO2e).
// =============================================================================
//
// This module is intentionally dependency-light (only the model registry) so it
// can be called from the store, the dashboard, a notebook, or a batch report.
// The session telemetry store holds the *assumptions* (EmissionFactors) as
// reactive state and recomputes on every read, so the dashboard's control panel
// can change an assumption and see all figures update instantly — nothing is
// baked in at ingest.
//
// HONESTY FIRST. These are order-of-magnitude estimates, not measurements. We
// can't see the serving hardware, batch size, or grid mix, so the model is a
// transparent, fully-overridable set of per-token factors. The methodology:
//
//   • Decode (output + thinking) tokens dominate: each is one autoregressive
//     forward pass. Prefill (input) tokens are processed in parallel and cost a
//     small fraction per token. (Luccioni et al., "Power Hungry Processing",
//     2024; Epoch AI inference-energy estimates, 2025.)
//   • Per-token energy scales with model size, approximated by the registry
//     `tier` (budget < mid < frontier).
//   • Cache reads reuse a stored KV cache → little compute (reduced factor).
//     Cache writes still prefill the tokens and store them → a small premium
//     (mirrors providers charging ~1.25× input for cache writes).
//   • Data-center overhead is folded in with a PUE multiplier; emissions are
//     energy × grid carbon intensity.
//
// Sanity check: a 1,000-in / 500-out call on a `mid` model ≈ 0.43 Wh ≈ 0.21 g
// CO2e with the defaults below — in line with published per-query figures.
// =============================================================================

import type { TokenUsage } from '@byo-keys/core';
import type { ModelTier } from '../models';
import { getModel } from '../models';

/** Per-tier token factor (Wh), plus an `unknown` fallback for unpriced models. */
export type TierFactors = Record<ModelTier | 'unknown', number>;

export interface EmissionFactors {
  /** Data-center overhead multiplier (PUE — power usage effectiveness). Default 1.2. */
  pue: number;
  /**
   * Grid carbon intensity, gCO2e per kWh. Default 480 — a global-average grid
   * (IEA, ~2023). Set to your region/provider for a sharper estimate.
   */
  gridIntensityGramsPerKwh: number;
  /** Energy per *generated* token (output + thinking), Wh, by tier. */
  outputWhPerToken: TierFactors;
  /** Energy per *prefill* token (fresh input), Wh, by tier. */
  inputWhPerToken: TierFactors;
  /** Multiplier on cache-*read* tokens — KV cache reused, little compute. Default 0.1. */
  cacheReadFactor: number;
  /** Multiplier on cache-*write* tokens — prefilled + stored, small premium. Default 1.25. */
  cacheWriteFactor: number;
}

/**
 * Default factors. Deliberately conservative and easy to override. Output
 * tokens are ~10× the per-token energy of input tokens; frontier is ~3× mid,
 * mid ~3× budget. Treat as estimates accurate to roughly an order of magnitude.
 */
export const DEFAULT_EMISSION_FACTORS: EmissionFactors = {
  pue: 1.2,
  gridIntensityGramsPerKwh: 480,
  outputWhPerToken: {
    budget: 0.0002,
    mid: 0.0006,
    frontier: 0.0018,
    unknown: 0.0006,
  },
  inputWhPerToken: {
    budget: 0.00002,
    mid: 0.00006,
    frontier: 0.00018,
    unknown: 0.00006,
  },
  cacheReadFactor: 0.1,
  cacheWriteFactor: 1.25,
};

/** Grid carbon-intensity presets (gCO2e/kWh) for the dashboard's region picker. */
export const GRID_PRESETS: ReadonlyArray<{ label: string; gramsPerKwh: number }> = [
  { label: 'Global', gramsPerKwh: 480 },
  { label: 'US', gramsPerKwh: 370 },
  { label: 'EU', gramsPerKwh: 250 },
  { label: 'France', gramsPerKwh: 45 },
  { label: 'Coal-heavy', gramsPerKwh: 820 },
];

export interface EnergyCarbonEstimate {
  /** Estimated electricity for the call, watt-hours. */
  wattHours: number;
  /** Estimated emissions for the call, grams CO2-equivalent. */
  gramsCO2e: number;
}

/**
 * A partial override of the factors. Top-level scalars are optional, and each
 * per-tier map may set only the tiers it wants to change (the rest are kept).
 */
export interface FactorOverrides {
  pue?: number;
  gridIntensityGramsPerKwh?: number;
  cacheReadFactor?: number;
  cacheWriteFactor?: number;
  outputWhPerToken?: Partial<TierFactors>;
  inputWhPerToken?: Partial<TierFactors>;
}

/** Deep-merge a partial override onto a base (tier sub-objects merge too). */
export function mergeFactors(
  base: EmissionFactors,
  overrides: FactorOverrides = {}
): EmissionFactors {
  return {
    pue: overrides.pue ?? base.pue,
    gridIntensityGramsPerKwh: overrides.gridIntensityGramsPerKwh ?? base.gridIntensityGramsPerKwh,
    cacheReadFactor: overrides.cacheReadFactor ?? base.cacheReadFactor,
    cacheWriteFactor: overrides.cacheWriteFactor ?? base.cacheWriteFactor,
    outputWhPerToken: { ...base.outputWhPerToken, ...overrides.outputWhPerToken },
    inputWhPerToken: { ...base.inputWhPerToken, ...overrides.inputWhPerToken },
  };
}

/** A fresh, independent copy of the default factors (safe to mutate as state). */
export function cloneDefaultFactors(): EmissionFactors {
  return mergeFactors(DEFAULT_EMISSION_FACTORS);
}

/**
 * Estimate energy + carbon for one call from its token usage and model id.
 * Returns null when usage is unknown (nothing to estimate from).
 */
export function estimateEnergyCarbon(
  usage: TokenUsage | undefined,
  modelId: string,
  factors: EmissionFactors = DEFAULT_EMISSION_FACTORS
): EnergyCarbonEstimate | null {
  if (!usage) return null;

  const tier: ModelTier | 'unknown' = getModel(modelId)?.tier ?? 'unknown';
  const inWh = factors.inputWhPerToken[tier] ?? factors.inputWhPerToken.unknown;
  const outWh = factors.outputWhPerToken[tier] ?? factors.outputWhPerToken.unknown;

  // byo-keys reports these as separate, non-overlapping counts.
  const input = usage.inputTokens || 0;
  const cacheWrite = usage.cacheWriteTokens || 0;
  const cacheRead = usage.cacheReadTokens || 0;
  const output = usage.outputTokens || 0;
  const thinking = usage.thinkingTokens || 0;

  const prefillWh =
    input * inWh +
    cacheWrite * inWh * factors.cacheWriteFactor +
    cacheRead * inWh * factors.cacheReadFactor;
  const decodeWh = (output + thinking) * outWh;
  const wattHours = (prefillWh + decodeWh) * factors.pue;
  const gramsCO2e = (wattHours / 1000) * factors.gridIntensityGramsPerKwh;

  return { wattHours, gramsCO2e };
}

// --- Display helpers --------------------------------------------------------

/** Format watt-hours for display, scaling the unit to the magnitude. */
export function formatEnergy(wattHours: number | null | undefined): string {
  if (wattHours == null) return '—';
  if (wattHours === 0) return '0 Wh';
  if (wattHours < 1) return `${wattHours.toFixed(3)} Wh`;
  if (wattHours < 1000) return `${wattHours.toFixed(1)} Wh`;
  return `${(wattHours / 1000).toFixed(2)} kWh`;
}

/** Format grams CO2e for display, scaling g → kg as needed. */
export function formatCarbon(gramsCO2e: number | null | undefined): string {
  if (gramsCO2e == null) return '—';
  if (gramsCO2e === 0) return '0 g';
  if (gramsCO2e < 1) return `${gramsCO2e.toFixed(3)} g`;
  if (gramsCO2e < 1000) return `${gramsCO2e.toFixed(1)} g`;
  return `${(gramsCO2e / 1000).toFixed(2)} kg`;
}
