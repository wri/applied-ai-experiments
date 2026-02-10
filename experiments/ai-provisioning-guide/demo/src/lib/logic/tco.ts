import type { MethodId, MethodAssumptions, TCOInputs, TCOBreakdown, MethodTCO, MethodTCOExpanded } from '../types.js';

/**
 * Calculate monthly TCO for a single method.
 */
export function calculateMethodTCO(
  methodId: MethodId,
  inputs: TCOInputs,
  assumptions: MethodAssumptions,
): MethodTCO {
  const { monthlyVolume, avgInputTokens, avgOutputTokens } = inputs;
  const {
    inputTokenPricePerMillion,
    outputTokenPricePerMillion,
    routerMarkupPercent,
    monthlyInfraCost,
    devHoursInitial,
    devHourlyRate,
    amortizationMonths,
    opsHoursMonthly,
    opsHourlyRate,
  } = assumptions;

  // Inference cost
  const totalInputTokens = monthlyVolume * avgInputTokens;
  const totalOutputTokens = monthlyVolume * avgOutputTokens;
  const baseInference =
    (totalInputTokens / 1_000_000) * inputTokenPricePerMillion +
    (totalOutputTokens / 1_000_000) * outputTokenPricePerMillion;
  const inference = baseInference * (1 + routerMarkupPercent / 100);

  // Infrastructure cost (fixed monthly)
  const infrastructure = monthlyInfraCost;

  // Development cost (amortized)
  const development = (devHoursInitial * devHourlyRate) / amortizationMonths;

  // Operations cost
  const operations = opsHoursMonthly * opsHourlyRate;

  const total = inference + infrastructure + development + operations;
  const costPerRequest = monthlyVolume > 0 ? total / monthlyVolume : 0;

  return {
    methodId,
    breakdown: { inference, infrastructure, development, operations, total },
    costPerRequest,
  };
}

/**
 * Calculate TCO for all given methods.
 */
export function calculateAllTCO(
  methodIds: MethodId[],
  inputs: TCOInputs,
  assumptions: Record<MethodId, MethodAssumptions>,
): MethodTCO[] {
  return methodIds.map((id) => calculateMethodTCO(id, inputs, assumptions[id]));
}

/**
 * Calculate TCO at a range of volumes for cost-curve charts.
 */
export function calculateTCOCurve(
  methodIds: MethodId[],
  inputs: TCOInputs,
  assumptions: Record<MethodId, MethodAssumptions>,
  volumePoints?: number[],
): { volume: number; methodId: MethodId; total: number; costPerRequest: number }[] {
  const points = volumePoints ?? [
    100, 500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000, 1_000_000,
  ];

  const data: { volume: number; methodId: MethodId; total: number; costPerRequest: number }[] = [];

  for (const volume of points) {
    const volumeInputs = { ...inputs, monthlyVolume: volume };
    for (const methodId of methodIds) {
      const tco = calculateMethodTCO(methodId, volumeInputs, assumptions[methodId]);
      data.push({
        volume,
        methodId,
        total: tco.breakdown.total,
        costPerRequest: tco.costPerRequest,
      });
    }
  }

  return data;
}

/**
 * Calculate expanded TCO for a single method, splitting upfront vs recurring.
 */
export function calculateMethodTCOExpanded(
  methodId: MethodId,
  inputs: TCOInputs,
  assumptions: MethodAssumptions,
  horizonMonths: number,
): MethodTCOExpanded {
  const base = calculateMethodTCO(methodId, inputs, assumptions);

  const { monthlyVolume, avgInputTokens, avgOutputTokens } = inputs;
  const {
    inputTokenPricePerMillion,
    outputTokenPricePerMillion,
    routerMarkupPercent,
    monthlyInfraCost,
    devHoursInitial,
    devHourlyRate,
    opsHoursMonthly,
    opsHourlyRate,
  } = assumptions;

  const upfront = devHoursInitial * devHourlyRate;

  const totalInputTokens = monthlyVolume * avgInputTokens;
  const totalOutputTokens = monthlyVolume * avgOutputTokens;
  const baseInference =
    (totalInputTokens / 1_000_000) * inputTokenPricePerMillion +
    (totalOutputTokens / 1_000_000) * outputTokenPricePerMillion;
  const monthlyInference = baseInference * (1 + routerMarkupPercent / 100);
  const monthlyInfrastructure = monthlyInfraCost;
  const monthlyOperations = opsHoursMonthly * opsHourlyRate;
  const monthlyRecurring = monthlyInference + monthlyInfrastructure + monthlyOperations;
  const periodTotal = upfront + monthlyRecurring * horizonMonths;

  return {
    ...base,
    expanded: {
      upfront,
      monthlyInference,
      monthlyInfrastructure,
      monthlyOperations,
      monthlyRecurring,
      periodTotal,
      monthly: base.breakdown,
    },
  };
}

/**
 * Calculate expanded TCO for all given methods.
 */
export function calculateAllTCOExpanded(
  methodIds: MethodId[],
  inputs: TCOInputs,
  assumptions: Record<MethodId, MethodAssumptions>,
  horizonMonths: number,
): MethodTCOExpanded[] {
  return methodIds.map((id) => calculateMethodTCOExpanded(id, inputs, assumptions[id], horizonMonths));
}

/**
 * Generate month-by-month cumulative cost data for a line chart.
 * Month 0 = upfront cost only.
 */
export function calculateCumulativeCurve(
  methodIds: MethodId[],
  inputs: TCOInputs,
  assumptions: Record<MethodId, MethodAssumptions>,
  maxMonths: number,
): { month: number; methodId: MethodId; cumulative: number }[] {
  const data: { month: number; methodId: MethodId; cumulative: number }[] = [];

  for (const methodId of methodIds) {
    const a = assumptions[methodId];
    const upfront = a.devHoursInitial * a.devHourlyRate;

    const { monthlyVolume, avgInputTokens, avgOutputTokens } = inputs;
    const totalInputTokens = monthlyVolume * avgInputTokens;
    const totalOutputTokens = monthlyVolume * avgOutputTokens;
    const baseInference =
      (totalInputTokens / 1_000_000) * a.inputTokenPricePerMillion +
      (totalOutputTokens / 1_000_000) * a.outputTokenPricePerMillion;
    const monthlyInference = baseInference * (1 + a.routerMarkupPercent / 100);
    const monthlyRecurring = monthlyInference + a.monthlyInfraCost + a.opsHoursMonthly * a.opsHourlyRate;

    for (let month = 0; month <= maxMonths; month++) {
      data.push({ month, methodId, cumulative: upfront + monthlyRecurring * month });
    }
  }

  return data;
}
