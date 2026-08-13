import type { MethodId, MethodAssumptions, TCOInputs, TabId } from '../types.js';

// ============================================================
// 1. App-state initial defaults
// ============================================================

/** Tab shown on first load. */
export const DEFAULT_TAB: TabId = 'wizard';

/** Wizard starts on the first question. */
export const DEFAULT_WIZARD_STEP = 0;

/** Default TCO time horizon, in months. */
export const DEFAULT_TIME_HORIZON = 12;

/** Methods selected for comparison/calculation on first load. */
export const DEFAULT_SELECTED_METHODS: MethodId[] = [
  'provider_direct',
  'managed_router',
  'managed_inference',
];

// ============================================================
// 2. Shared assumption rates
// Single source for the labor rates / amortization that every
// method shares. Also surfaced read-only via AssumptionsReference.
// ============================================================

export const SHARED_RATES = {
  devHourlyRate: 150,
  opsHourlyRate: 100,
  amortizationMonths: 12,
} as const;

// ============================================================
// 3. TCO input defaults + per-method assumptions
// ============================================================

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
    devHourlyRate: SHARED_RATES.devHourlyRate,
    amortizationMonths: SHARED_RATES.amortizationMonths,
    opsHoursMonthly: 2,
    opsHourlyRate: SHARED_RATES.opsHourlyRate,
  },
  provider_direct: {
    inputTokenPricePerMillion: 3.0,
    outputTokenPricePerMillion: 15.0,
    routerMarkupPercent: 0,
    monthlyInfraCost: 0,
    devHoursInitial: 16,
    devHourlyRate: SHARED_RATES.devHourlyRate,
    amortizationMonths: SHARED_RATES.amortizationMonths,
    opsHoursMonthly: 4,
    opsHourlyRate: SHARED_RATES.opsHourlyRate,
  },
  managed_router: {
    inputTokenPricePerMillion: 3.0,
    outputTokenPricePerMillion: 15.0,
    routerMarkupPercent: 15,
    monthlyInfraCost: 0,
    devHoursInitial: 16,
    devHourlyRate: SHARED_RATES.devHourlyRate,
    amortizationMonths: SHARED_RATES.amortizationMonths,
    opsHoursMonthly: 4,
    opsHourlyRate: SHARED_RATES.opsHourlyRate,
  },
  self_built_proxy: {
    inputTokenPricePerMillion: 3.0,
    outputTokenPricePerMillion: 15.0,
    routerMarkupPercent: 0,
    monthlyInfraCost: 150,
    devHoursInitial: 80,
    devHourlyRate: SHARED_RATES.devHourlyRate,
    amortizationMonths: SHARED_RATES.amortizationMonths,
    opsHoursMonthly: 8,
    opsHourlyRate: SHARED_RATES.opsHourlyRate,
  },
  managed_inference: {
    inputTokenPricePerMillion: 0.25,
    outputTokenPricePerMillion: 1.25,
    routerMarkupPercent: 0,
    monthlyInfraCost: 0,
    devHoursInitial: 24,
    devHourlyRate: SHARED_RATES.devHourlyRate,
    amortizationMonths: SHARED_RATES.amortizationMonths,
    opsHoursMonthly: 4,
    opsHourlyRate: SHARED_RATES.opsHourlyRate,
  },
  full_self_hosted: {
    inputTokenPricePerMillion: 0,
    outputTokenPricePerMillion: 0,
    routerMarkupPercent: 0,
    monthlyInfraCost: 800,
    devHoursInitial: 160,
    devHourlyRate: SHARED_RATES.devHourlyRate,
    amortizationMonths: SHARED_RATES.amortizationMonths,
    opsHoursMonthly: 20,
    opsHourlyRate: SHARED_RATES.opsHourlyRate,
  },
  edge_browser: {
    inputTokenPricePerMillion: 0,
    outputTokenPricePerMillion: 0,
    routerMarkupPercent: 0,
    monthlyInfraCost: 75,
    devHoursInitial: 80,
    devHourlyRate: SHARED_RATES.devHourlyRate,
    amortizationMonths: SHARED_RATES.amortizationMonths,
    opsHoursMonthly: 4,
    opsHourlyRate: SHARED_RATES.opsHourlyRate,
  },
  hybrid: {
    inputTokenPricePerMillion: 1.5,
    outputTokenPricePerMillion: 7.5,
    routerMarkupPercent: 0,
    monthlyInfraCost: 100,
    devHoursInitial: 200,
    devHourlyRate: SHARED_RATES.devHourlyRate,
    amortizationMonths: SHARED_RATES.amortizationMonths,
    opsHoursMonthly: 16,
    opsHourlyRate: SHARED_RATES.opsHourlyRate,
  },
};

// ============================================================
// 4. Input / slider configuration
// ============================================================

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

/** Min/max/step for every calculator slider (volume inputs + assumptions). */
export const SLIDER_RANGES = {
  monthlyVolume: { min: 100, max: 1_000_000, step: 100 },
  inputTokens: { min: 50, max: 16_000, step: 50 },
  outputTokens: { min: 25, max: 8_000, step: 25 },
  inputPrice: { min: 0, max: 50, step: 0.25 },
  outputPrice: { min: 0, max: 200, step: 0.5 },
  routerMarkup: { min: 0, max: 50, step: 1 },
  monthlyInfra: { min: 0, max: 5000, step: 25 },
  devHours: { min: 0, max: 400, step: 8 },
  opsHours: { min: 0, max: 80, step: 1 },
} as const;

// ============================================================
// 5. Time-horizon options
// Single source for the calculator's horizon pills and url.ts's
// allow-list. ALLOWED_HORIZONS stays an `as const` literal tuple
// because url.ts relies on its literal-union element type for
// `.includes`; the type guard below keeps the two from drifting.
// ============================================================

export const HORIZON_OPTIONS = [
  { value: 1, label: '1 mo' },
  { value: 3, label: '3 mo' },
  { value: 6, label: '6 mo' },
  { value: 12, label: '1 yr' },
  { value: 24, label: '2 yr' },
  { value: 36, label: '3 yr' },
] as const;

export const ALLOWED_HORIZONS = [1, 3, 6, 12, 24, 36] as const;

// Compile-time guard: every HORIZON_OPTIONS value must be in ALLOWED_HORIZONS.
// Emits nothing at runtime; a mismatch makes `_HorizonsInSync` resolve to
// `never`, so the assignment below fails to type-check.
type _HorizonsInSync = (typeof HORIZON_OPTIONS)[number]['value'] extends (typeof ALLOWED_HORIZONS)[number]
  ? true
  : never;
const _horizonsInSync: _HorizonsInSync = true;
void _horizonsInSync;

// ============================================================
// 6. Visualization config
// ============================================================

/** Line/legend color per method (cost-curve chart, method toggles). */
export const methodColors: Record<MethodId, string> = {
  byok: '#6366f1',
  provider_direct: '#f59e0b',
  managed_router: '#10b981',
  self_built_proxy: '#ef4444',
  managed_inference: '#8b5cf6',
  full_self_hosted: '#06b6d4',
  edge_browser: '#ec4899',
  hybrid: '#78716c',
};

/** Shared Observable Plot dimensions/margins for the calculator charts. */
export const CHART_DIMENSIONS = {
  barRowHeight: 50,
  barMinHeight: 200,
  curveHeight: 300,
  curveMinMonths: 36,
  marginLeftWide: 90, // stacked-bar charts
  marginLeftNarrow: 70, // line/curve charts
  marginRight: 20,
} as const;

// ============================================================
// 7. Analysis / insight config
// ============================================================

/** Volume points sampled for cost-curve charts. */
export const CURVE_VOLUME_POINTS = [
  100, 500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000, 1_000_000,
] as const;

/** Volume points scanned when searching for a method crossover (extends the curve range). */
export const CROSSOVER_VOLUME_POINTS = [...CURVE_VOLUME_POINTS, 2_000_000] as const;

/** Thresholds used when generating TCO insights. */
export const INSIGHT_CONFIG = {
  topMethodCount: 3,
  dominantCategoryThresholdPct: 50,
} as const;
