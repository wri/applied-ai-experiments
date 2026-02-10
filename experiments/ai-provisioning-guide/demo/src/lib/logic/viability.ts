import type { ConstraintAnswers, MethodId, MethodViability, Viability } from '../types.js';
import { ALL_METHOD_IDS } from '../types.js';
import { constraintsById } from '../data/constraints.js';

/**
 * Compute viability for all methods given the current constraint answers.
 * A method is 'eliminated' if any constraint eliminates it.
 * A method is 'caution' if any constraint flags caution (and none eliminate).
 * Otherwise it's 'viable'.
 */
export function computeViability(
  answers: ConstraintAnswers,
): Map<MethodId, MethodViability> {
  const result = new Map<MethodId, MethodViability>();

  for (const methodId of ALL_METHOD_IDS) {
    const reasons: string[] = [];
    let cautionCount = 0;
    let eliminatedCount = 0;
    let worstViability: Viability = 'viable';

    for (const [constraintId, answerId] of Object.entries(answers)) {
      if (!answerId) continue;

      const question = constraintsById.get(constraintId as any);
      if (!question) continue;

      const option = question.options.find((o) => o.id === answerId);
      if (!option) continue;

      const rule = option.viabilityRules[methodId];
      if (!rule) continue;

      reasons.push(`${question.title}: ${rule.reason}`);

      if (rule.viability === 'eliminated') {
        eliminatedCount++;
        worstViability = 'eliminated';
      } else if (rule.viability === 'caution' && worstViability !== 'eliminated') {
        cautionCount++;
        worstViability = 'caution';
      }
    }

    result.set(methodId, {
      viability: worstViability,
      reasons,
      cautionCount,
      eliminatedCount,
    });
  }

  return result;
}

/**
 * Sort methods: viable first, then caution, then eliminated.
 * Within each tier, preserve original order.
 */
export function sortByViability(
  methodIds: MethodId[],
  viabilityMap: Map<MethodId, MethodViability>,
): MethodId[] {
  const order: Record<Viability, number> = { viable: 0, caution: 1, eliminated: 2 };
  return [...methodIds].sort((a, b) => {
    const va = viabilityMap.get(a)?.viability ?? 'viable';
    const vb = viabilityMap.get(b)?.viability ?? 'viable';
    return order[va] - order[vb];
  });
}
