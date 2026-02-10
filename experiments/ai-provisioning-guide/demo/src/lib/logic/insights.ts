import type { MethodTCO, MethodId, MethodAssumptions, TCOInputs } from '../types.js';
import { methodsById } from '../data/methods.js';
import { calculateMethodTCO } from './tco.js';

/**
 * Generate human-readable insights from TCO results.
 */
export function generateInsights(tcoResults: MethodTCO[]): string[] {
  if (tcoResults.length === 0) return [];

  const insights: string[] = [];
  const sorted = [...tcoResults].sort((a, b) => a.breakdown.total - b.breakdown.total);

  // Cheapest method
  const cheapest = sorted[0];
  const cheapestName = methodsById.get(cheapest.methodId)?.shortName ?? cheapest.methodId;
  insights.push(
    `**${cheapestName}** is the lowest-cost option at **$${Math.round(cheapest.breakdown.total)}/mo**.`,
  );

  // If there's more than one, show cost difference
  if (sorted.length >= 2) {
    const mostExpensive = sorted[sorted.length - 1];
    const expensiveName = methodsById.get(mostExpensive.methodId)?.shortName ?? mostExpensive.methodId;
    const diff = mostExpensive.breakdown.total - cheapest.breakdown.total;
    if (diff > 0) {
      insights.push(
        `**${expensiveName}** costs **$${Math.round(diff)}/mo more** than ${cheapestName}.`,
      );
    }
  }

  // Dominant cost category
  for (const tco of sorted.slice(0, 3)) {
    const name = methodsById.get(tco.methodId)?.shortName ?? tco.methodId;
    const { inference, infrastructure, development, operations } = tco.breakdown;
    const categories = [
      { label: 'inference', value: inference },
      { label: 'infrastructure', value: infrastructure },
      { label: 'development', value: development },
      { label: 'operations', value: operations },
    ];
    const dominant = categories.reduce((a, b) => (a.value > b.value ? a : b));
    if (tco.breakdown.total > 0) {
      const pct = Math.round((dominant.value / tco.breakdown.total) * 100);
      if (pct >= 50) {
        insights.push(
          `${name}'s cost is **${pct}% ${dominant.label}** — that's the lever to optimize.`,
        );
      }
    }
  }

  return insights.map((s) => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'));
}

/**
 * Find the approximate volume at which method B becomes cheaper than method A.
 * Returns null if no crossover exists in the 0–2M range.
 */
export function findCrossoverVolume(
  methodA: MethodId,
  methodB: MethodId,
  inputs: TCOInputs,
  assumptions: Record<MethodId, MethodAssumptions>,
): number | null {
  const volumes = [100, 500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000, 1_000_000, 2_000_000];

  let prevDiff: number | null = null;

  for (const volume of volumes) {
    const vi = { ...inputs, monthlyVolume: volume };
    const tcoA = calculateMethodTCO(methodA, vi, assumptions[methodA]);
    const tcoB = calculateMethodTCO(methodB, vi, assumptions[methodB]);
    const diff = tcoA.breakdown.total - tcoB.breakdown.total;

    if (prevDiff !== null && prevDiff * diff < 0) {
      // Sign changed — crossover is near this volume
      return volume;
    }
    prevDiff = diff;
  }

  return null;
}
