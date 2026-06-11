import type { ModelInfo, TokenUsage } from '@byo-keys/core';

/** Rough pre-run token estimate. ~4 chars per token is close enough for a forecast. */
export function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  /** null when the model has no pricing metadata */
  usd: number | null;
}

/**
 * Forecast the cost of a call before running it. Clearly an estimate —
 * label it as such in the UI.
 */
export function estimateCost(
  model: ModelInfo | undefined,
  inputText: string,
  expectedOutputTokens = 512
): CostEstimate {
  const inputTokens = estimateTokensFromText(inputText);
  const usd = priceFor(model, inputTokens, expectedOutputTokens);
  return { inputTokens, outputTokens: expectedOutputTokens, usd };
}

/** Actual cost from provider-reported usage. null when pricing is unknown. */
export function computeCost(model: ModelInfo | undefined, usage: TokenUsage): number | null {
  return priceFor(model, usage.inputTokens, usage.outputTokens);
}

function priceFor(
  model: ModelInfo | undefined,
  inputTokens: number,
  outputTokens: number
): number | null {
  if (
    !model ||
    model.inputPricePerMillion === undefined ||
    model.outputPricePerMillion === undefined
  ) {
    return null;
  }
  return (
    (inputTokens / 1_000_000) * model.inputPricePerMillion +
    (outputTokens / 1_000_000) * model.outputPricePerMillion
  );
}

/** Format a USD amount for display; sub-cent amounts keep enough precision to be meaningful. */
export function formatUsd(usd: number | null): string {
  if (usd === null) return 'n/a';
  if (usd === 0) return '$0.00';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

/** Sum usage across calls (e.g. a fan-out run). */
export function sumUsage(usages: Array<TokenUsage | undefined>): TokenUsage {
  const total: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  for (const usage of usages) {
    if (!usage) continue;
    total.inputTokens += usage.inputTokens;
    total.outputTokens += usage.outputTokens;
    total.totalTokens += usage.totalTokens;
  }
  return total;
}
