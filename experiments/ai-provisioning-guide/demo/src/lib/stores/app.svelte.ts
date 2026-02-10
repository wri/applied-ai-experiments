import type {
  TabId,
  ConstraintAnswers,
  ConstraintId,
  TCOInputs,
  MethodId,
  MethodAssumptions,
  MethodViability,
  MethodTCO,
  MethodTCOExpanded,
} from '../types.js';
import { ALL_METHOD_IDS, ALL_CONSTRAINT_IDS } from '../types.js';
import { defaultTCOInputs, defaultAssumptions } from '../data/defaults.js';
import { computeViability, sortByViability } from '../logic/viability.js';
import { calculateAllTCO, calculateAllTCOExpanded } from '../logic/tco.js';
import { generateInsights } from '../logic/insights.js';

// ---- Mutable state ----

let activeTab = $state<TabId>('wizard');
let wizardStep = $state(0);
let constraintAnswers = $state<ConstraintAnswers>({});
let tcoInputs = $state<TCOInputs>({ ...defaultTCOInputs });
let assumptions = $state<Record<MethodId, MethodAssumptions>>(structuredClone(defaultAssumptions));
let selectedMethods = $state<MethodId[]>([
  'provider_direct',
  'managed_router',
  'managed_inference',
]);
let timeHorizonMonths = $state<number>(12);

// ---- Derived state ----

const viabilityMap = $derived(computeViability(constraintAnswers));

const sortedMethods = $derived(sortByViability(ALL_METHOD_IDS, viabilityMap));

const viableMethodIds = $derived(
  ALL_METHOD_IDS.filter((id) => {
    const v = viabilityMap.get(id);
    return !v || v.viability !== 'eliminated';
  }),
);

const tcoResults = $derived(calculateAllTCO(selectedMethods, tcoInputs, assumptions));

const tcoResultsExpanded = $derived(calculateAllTCOExpanded(selectedMethods, tcoInputs, assumptions, timeHorizonMonths));

const insights = $derived(generateInsights(tcoResults));

const answeredCount = $derived(
  ALL_CONSTRAINT_IDS.filter((id) => constraintAnswers[id] != null).length,
);

// ---- Actions ----

function setTab(tab: TabId) {
  activeTab = tab;
}

function setWizardStep(step: number) {
  wizardStep = Math.max(0, Math.min(step, ALL_CONSTRAINT_IDS.length));
}

function answerConstraint(constraintId: ConstraintId, optionId: string) {
  constraintAnswers = { ...constraintAnswers, [constraintId]: optionId };
}

function updateTCOInputs(partial: Partial<TCOInputs>) {
  tcoInputs = { ...tcoInputs, ...partial };
}

function updateAssumptions(methodId: MethodId, partial: Partial<MethodAssumptions>) {
  assumptions = {
    ...assumptions,
    [methodId]: { ...assumptions[methodId], ...partial },
  };
}

function toggleComparison(methodId: MethodId) {
  if (selectedMethods.includes(methodId)) {
    selectedMethods = selectedMethods.filter((id) => id !== methodId);
  } else {
    selectedMethods = [...selectedMethods, methodId];
  }
}

function setSelectedMethods(ids: MethodId[]) {
  selectedMethods = [...ids];
}

function setTimeHorizon(months: number) {
  timeHorizonMonths = months;
}

function reset() {
  wizardStep = 0;
  constraintAnswers = {};
  tcoInputs = { ...defaultTCOInputs };
  assumptions = structuredClone(defaultAssumptions);
  selectedMethods = ['provider_direct', 'managed_router', 'managed_inference'];
  timeHorizonMonths = 12;
}

// ---- Export as single store object ----

export const appStore = {
  get activeTab() { return activeTab; },
  get wizardStep() { return wizardStep; },
  get constraintAnswers() { return constraintAnswers; },
  get tcoInputs() { return tcoInputs; },
  get assumptions() { return assumptions; },
  get selectedMethods() { return selectedMethods; },
  get timeHorizonMonths() { return timeHorizonMonths; },

  get viabilityMap() { return viabilityMap; },
  get sortedMethods() { return sortedMethods; },
  get viableMethodIds() { return viableMethodIds; },
  get tcoResults() { return tcoResults; },
  get tcoResultsExpanded() { return tcoResultsExpanded; },
  get insights() { return insights; },
  get answeredCount() { return answeredCount; },

  setTab,
  setWizardStep,
  answerConstraint,
  updateTCOInputs,
  updateAssumptions,
  toggleComparison,
  setSelectedMethods,
  setTimeHorizon,
  reset,
};
