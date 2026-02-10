import type { MethodId, MethodAssumptions, TCOInputs } from '../types.js';

/** Default TCO inputs */
export const defaultTCOInputs: TCOInputs = {
  monthlyVolume: 10000,
  avgInputTokens: 800,
  avgOutputTokens: 400,
};

/** Per-method default assumptions based on the decision guide's cost models */
export const defaultAssumptions: Record<MethodId, MethodAssumptions> = {
  byok: {
    inputTokenPricePerMillion: 0,
    outputTokenPricePerMillion: 0,
    routerMarkupPercent: 0,
    monthlyInfraCost: 0,
    devHoursInitial: 16,
    devHourlyRate: 150,
    amortizationMonths: 12,
    opsHoursMonthly: 2,
    opsHourlyRate: 100,
  },
  provider_direct: {
    inputTokenPricePerMillion: 3.0,
    outputTokenPricePerMillion: 15.0,
    routerMarkupPercent: 0,
    monthlyInfraCost: 0,
    devHoursInitial: 16,
    devHourlyRate: 150,
    amortizationMonths: 12,
    opsHoursMonthly: 4,
    opsHourlyRate: 100,
  },
  managed_router: {
    inputTokenPricePerMillion: 3.0,
    outputTokenPricePerMillion: 15.0,
    routerMarkupPercent: 15,
    monthlyInfraCost: 0,
    devHoursInitial: 16,
    devHourlyRate: 150,
    amortizationMonths: 12,
    opsHoursMonthly: 4,
    opsHourlyRate: 100,
  },
  self_built_proxy: {
    inputTokenPricePerMillion: 3.0,
    outputTokenPricePerMillion: 15.0,
    routerMarkupPercent: 0,
    monthlyInfraCost: 150,
    devHoursInitial: 80,
    devHourlyRate: 150,
    amortizationMonths: 12,
    opsHoursMonthly: 8,
    opsHourlyRate: 100,
  },
  managed_inference: {
    inputTokenPricePerMillion: 0.25,
    outputTokenPricePerMillion: 1.25,
    routerMarkupPercent: 0,
    monthlyInfraCost: 0,
    devHoursInitial: 24,
    devHourlyRate: 150,
    amortizationMonths: 12,
    opsHoursMonthly: 4,
    opsHourlyRate: 100,
  },
  full_self_hosted: {
    inputTokenPricePerMillion: 0,
    outputTokenPricePerMillion: 0,
    routerMarkupPercent: 0,
    monthlyInfraCost: 800,
    devHoursInitial: 160,
    devHourlyRate: 150,
    amortizationMonths: 12,
    opsHoursMonthly: 20,
    opsHourlyRate: 100,
  },
  edge_browser: {
    inputTokenPricePerMillion: 0,
    outputTokenPricePerMillion: 0,
    routerMarkupPercent: 0,
    monthlyInfraCost: 75,
    devHoursInitial: 80,
    devHourlyRate: 150,
    amortizationMonths: 12,
    opsHoursMonthly: 4,
    opsHourlyRate: 100,
  },
  hybrid: {
    inputTokenPricePerMillion: 1.5,
    outputTokenPricePerMillion: 7.5,
    routerMarkupPercent: 0,
    monthlyInfraCost: 100,
    devHoursInitial: 200,
    devHourlyRate: 150,
    amortizationMonths: 12,
    opsHoursMonthly: 16,
    opsHourlyRate: 100,
  },
};

/** Volume presets for the slider */
export const volumePresets = [
  { value: 500, label: '500/mo' },
  { value: 2_000, label: '2K/mo' },
  { value: 10_000, label: '10K/mo' },
  { value: 50_000, label: '50K/mo' },
  { value: 200_000, label: '200K/mo' },
  { value: 1_000_000, label: '1M/mo' },
];

/** Token-size presets */
export const tokenSizePresets = [
  { id: 'small', label: 'Small', input: 200, output: 100, description: 'Classification, short extraction' },
  { id: 'medium', label: 'Medium', input: 800, output: 400, description: 'Summarization, Q&A' },
  { id: 'large', label: 'Large', input: 2000, output: 1000, description: 'Long-form content, analysis' },
  { id: 'very_large', label: 'Very Large', input: 8000, output: 2000, description: 'Document processing, RAG' },
];
