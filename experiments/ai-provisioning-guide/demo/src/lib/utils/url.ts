import type { ConstraintAnswers, MethodId, TabId, TCOInputs } from '../types.js';
import { ALL_CONSTRAINT_IDS, ALL_METHOD_IDS } from '../types.js';

const TAB_PARAM = 'tab';
const VOLUME_PARAM = 'vol';
const INPUT_TOKENS_PARAM = 'in';
const OUTPUT_TOKENS_PARAM = 'out';
const METHODS_PARAM = 'methods';
const HORIZON_PARAM = 'horizon';

export const ALLOWED_HORIZONS = [1, 3, 6, 12, 24, 36] as const;

/**
 * Encode current app state into URL search params.
 */
export function encodeStateToParams(state: {
  activeTab: TabId;
  constraintAnswers: ConstraintAnswers;
  tcoInputs: TCOInputs;
  selectedMethods: MethodId[];
  timeHorizonMonths: number;
}): URLSearchParams {
  const params = new URLSearchParams();

  params.set(TAB_PARAM, state.activeTab);

  // Constraint answers
  for (const id of ALL_CONSTRAINT_IDS) {
    const answer = state.constraintAnswers[id];
    if (answer) params.set(id, answer);
  }

  // TCO inputs
  params.set(VOLUME_PARAM, String(state.tcoInputs.monthlyVolume));
  params.set(INPUT_TOKENS_PARAM, String(state.tcoInputs.avgInputTokens));
  params.set(OUTPUT_TOKENS_PARAM, String(state.tcoInputs.avgOutputTokens));

  // Selected methods
  if (state.selectedMethods.length > 0) {
    params.set(METHODS_PARAM, state.selectedMethods.join(','));
  }

  // Time horizon
  params.set(HORIZON_PARAM, String(state.timeHorizonMonths));

  return params;
}

/**
 * Decode URL search params into partial app state.
 */
export function decodeStateFromParams(params: URLSearchParams): {
  activeTab?: TabId;
  constraintAnswers?: ConstraintAnswers;
  tcoInputs?: Partial<TCOInputs>;
  selectedMethods?: MethodId[];
  timeHorizonMonths?: number;
} {
  const result: ReturnType<typeof decodeStateFromParams> = {};

  const tab = params.get(TAB_PARAM);
  if (tab && ['wizard', 'calculator', 'compare', 'guide'].includes(tab)) {
    result.activeTab = tab as TabId;
  }

  // Constraint answers
  const answers: ConstraintAnswers = {};
  let hasAnswers = false;
  for (const id of ALL_CONSTRAINT_IDS) {
    const val = params.get(id);
    if (val) {
      answers[id] = val;
      hasAnswers = true;
    }
  }
  if (hasAnswers) result.constraintAnswers = answers;

  // TCO inputs
  const vol = params.get(VOLUME_PARAM);
  const inp = params.get(INPUT_TOKENS_PARAM);
  const out = params.get(OUTPUT_TOKENS_PARAM);
  if (vol || inp || out) {
    result.tcoInputs = {};
    if (vol) result.tcoInputs.monthlyVolume = parseInt(vol, 10);
    if (inp) result.tcoInputs.avgInputTokens = parseInt(inp, 10);
    if (out) result.tcoInputs.avgOutputTokens = parseInt(out, 10);
  }

  // Selected methods
  const methodsStr = params.get(METHODS_PARAM);
  if (methodsStr) {
    const ids = methodsStr.split(',').filter((id) => ALL_METHOD_IDS.includes(id as MethodId));
    if (ids.length > 0) result.selectedMethods = ids as MethodId[];
  }

  // Time horizon
  const horizon = params.get(HORIZON_PARAM);
  if (horizon) {
    const parsed = parseInt(horizon, 10);
    if (ALLOWED_HORIZONS.includes(parsed as any)) {
      result.timeHorizonMonths = parsed;
    }
  }

  return result;
}
