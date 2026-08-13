import { describe, it, expect } from 'vitest';
import type { TokenUsage } from '@byo-keys/core';
import type { InspectableRequest } from '../types';
import { createSessionTelemetry } from './session-telemetry.svelte';
import {
  estimateEnergyCarbon,
  formatEnergy,
  formatCarbon,
  DEFAULT_EMISSION_FACTORS,
} from './energy-carbon';

const FRONTIER = 'claude-opus-4-8';
const BUDGET = 'claude-haiku-4-5-20251001';
const usage: TokenUsage = { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 };

function req(overrides: Partial<InspectableRequest> = {}): InspectableRequest {
  return {
    providerId: 'anthropic',
    model: FRONTIER,
    messages: [{ role: 'user', content: 'hi' }],
    params: { temperature: 0.7, maxTokens: 100 },
    sentAt: 0,
    ...overrides,
  };
}

describe('estimateEnergyCarbon', () => {
  it('returns null when usage is unknown', () => {
    expect(estimateEnergyCarbon(undefined, FRONTIER)).toBeNull();
  });

  it('produces positive energy and carbon for a priced call', () => {
    const est = estimateEnergyCarbon(usage, 'gpt-4o')!;
    expect(est.wattHours).toBeGreaterThan(0);
    expect(est.gramsCO2e).toBeGreaterThan(0);
  });

  it('scales with model tier (frontier > budget for the same tokens)', () => {
    const frontier = estimateEnergyCarbon(usage, FRONTIER)!;
    const budget = estimateEnergyCarbon(usage, BUDGET)!;
    expect(frontier.wattHours).toBeGreaterThan(budget.wattHours);
  });

  it('weighs output tokens far more heavily than input tokens', () => {
    const heavyOutput = estimateEnergyCarbon(
      { inputTokens: 0, outputTokens: 1000, totalTokens: 1000 },
      FRONTIER
    )!;
    const heavyInput = estimateEnergyCarbon(
      { inputTokens: 1000, outputTokens: 0, totalTokens: 1000 },
      FRONTIER
    )!;
    expect(heavyOutput.wattHours).toBeGreaterThan(heavyInput.wattHours);
  });

  it('treats cache reads as cheap and cache writes as a premium', () => {
    const read = estimateEnergyCarbon(
      { inputTokens: 0, outputTokens: 0, totalTokens: 1000, cacheReadTokens: 1000 },
      FRONTIER
    )!;
    const write = estimateEnergyCarbon(
      { inputTokens: 0, outputTokens: 0, totalTokens: 1000, cacheWriteTokens: 1000 },
      FRONTIER
    )!;
    const fresh = estimateEnergyCarbon(
      { inputTokens: 1000, outputTokens: 0, totalTokens: 1000 },
      FRONTIER
    )!;
    expect(read.wattHours).toBeLessThan(fresh.wattHours); // cacheReadFactor 0.1
    expect(write.wattHours).toBeGreaterThan(fresh.wattHours); // cacheWriteFactor 1.25
  });

  it('falls back to the unknown tier for unpriced models', () => {
    const est = estimateEnergyCarbon(usage, 'totally-made-up');
    expect(est).not.toBeNull();
    expect(est!.wattHours).toBeGreaterThan(0);
  });

  it('carbon scales linearly with grid intensity; energy is unaffected', () => {
    const base = estimateEnergyCarbon(usage, FRONTIER)!;
    const greener = estimateEnergyCarbon(usage, FRONTIER, {
      ...DEFAULT_EMISSION_FACTORS,
      gridIntensityGramsPerKwh: DEFAULT_EMISSION_FACTORS.gridIntensityGramsPerKwh / 2,
    })!;
    expect(greener.gramsCO2e).toBeCloseTo(base.gramsCO2e / 2, 6);
    expect(greener.wattHours).toBeCloseTo(base.wattHours, 6);
  });
});

describe('session store — live energy from reactive factors', () => {
  it('totals energy/carbon and recomputes when assumptions change', () => {
    const t = createSessionTelemetry();
    t.recordCall({ request: req(), usage, latencyMs: 100, finishReason: 'stop' });

    const agg = t.aggregates;
    expect(agg.hasEnergyData).toBe(true);
    expect(agg.totalWattHours).toBeGreaterThan(0);
    const before = agg.totalGramsCO2e;
    expect(before).toBeGreaterThan(0);

    // Halve the grid intensity → carbon halves, energy unchanged. No re-ingest.
    const energyBefore = t.aggregates.totalWattHours;
    t.setFactors({ gridIntensityGramsPerKwh: DEFAULT_EMISSION_FACTORS.gridIntensityGramsPerKwh / 2 });
    expect(t.aggregates.totalGramsCO2e).toBeCloseTo(before / 2, 6);
    expect(t.aggregates.totalWattHours).toBeCloseTo(energyBefore, 6);
  });

  it('per-tier overrides merge without dropping other tiers', () => {
    const t = createSessionTelemetry();
    t.setFactors({ outputWhPerToken: { frontier: 0.005 } });
    expect(t.factors.outputWhPerToken.frontier).toBe(0.005);
    // Other tiers retain their defaults.
    expect(t.factors.outputWhPerToken.budget).toBe(DEFAULT_EMISSION_FACTORS.outputWhPerToken.budget);
  });

  it('estimation can be turned off and reset', () => {
    const t = createSessionTelemetry();
    t.recordCall({ request: req(), usage, latencyMs: 100 });
    expect(t.estimateFor(t.entries[0])).not.toBeNull();

    t.setEnergyEnabled(false);
    expect(t.aggregates.hasEnergyData).toBe(false);
    expect(t.aggregates.totalGramsCO2e).toBe(0);
    expect(t.estimateFor(t.entries[0])).toBeNull();

    t.setEnergyEnabled(true);
    t.setFactors({ pue: 5 });
    t.resetFactors();
    expect(t.factors.pue).toBe(DEFAULT_EMISSION_FACTORS.pue);
  });
});

describe('format helpers', () => {
  it('formats energy across magnitudes', () => {
    expect(formatEnergy(null)).toBe('—');
    expect(formatEnergy(0)).toBe('0 Wh');
    expect(formatEnergy(0.432)).toBe('0.432 Wh');
    expect(formatEnergy(12.5)).toBe('12.5 Wh');
    expect(formatEnergy(2500)).toBe('2.50 kWh');
  });

  it('formats carbon across magnitudes', () => {
    expect(formatCarbon(null)).toBe('—');
    expect(formatCarbon(0.207)).toBe('0.207 g');
    expect(formatCarbon(15.4)).toBe('15.4 g');
    expect(formatCarbon(2500)).toBe('2.50 kg');
  });
});
