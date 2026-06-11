import { describe, it, expect } from 'vitest';
import type { ModelInfo } from '@byo-keys/core';
import { estimateTokensFromText, estimateCost, computeCost, formatUsd, sumUsage } from './cost';

const MODEL: ModelInfo = {
  id: 'test',
  name: 'Test',
  provider: 'anthropic',
  inputPricePerMillion: 3,
  outputPricePerMillion: 15,
};

describe('cost utilities', () => {
  it('estimates ~4 chars per token', () => {
    expect(estimateTokensFromText('a'.repeat(400))).toBe(100);
    expect(estimateTokensFromText('')).toBe(0);
  });

  it('estimates cost from text and expected output', () => {
    const estimate = estimateCost(MODEL, 'a'.repeat(4_000_000), 1_000_000);
    expect(estimate.inputTokens).toBe(1_000_000);
    expect(estimate.usd).toBeCloseTo(3 + 15);
  });

  it('returns null cost when pricing is missing', () => {
    const unpriced: ModelInfo = { id: 'x', name: 'X', provider: 'ollama' };
    expect(estimateCost(unpriced, 'hello').usd).toBeNull();
    expect(computeCost(unpriced, { inputTokens: 1, outputTokens: 1, totalTokens: 2 })).toBeNull();
    expect(computeCost(undefined, { inputTokens: 1, outputTokens: 1, totalTokens: 2 })).toBeNull();
  });

  it('computes actual cost from usage', () => {
    const cost = computeCost(MODEL, {
      inputTokens: 1_000_000,
      outputTokens: 2_000_000,
      totalTokens: 3_000_000,
    });
    expect(cost).toBeCloseTo(3 + 30);
  });

  it('formats USD sensibly', () => {
    expect(formatUsd(null)).toBe('n/a');
    expect(formatUsd(0.0042)).toBe('$0.0042');
    expect(formatUsd(1.5)).toBe('$1.50');
  });

  it('sums usage across calls', () => {
    const total = sumUsage([
      { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      undefined,
      { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    ]);
    expect(total).toEqual({ inputTokens: 11, outputTokens: 22, totalTokens: 33 });
  });
});
