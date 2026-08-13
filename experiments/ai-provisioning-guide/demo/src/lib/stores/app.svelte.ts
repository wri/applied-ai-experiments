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
import {
  defaultTCOInputs,
  defaultAssumptions,
  DEFAULT_TAB,
  DEFAULT_WIZARD_STEP,
  DEFAULT_TIME_HORIZON,
  DEFAULT_SELECTED_METHODS,
} from '../data/defaults.js';
import { computeViability, sortByViability } from '../logic/viability.js';
import { calculateAllTCO, calculateAllTCOExpanded } from '../logic/tco.js';
import { generateInsights } from '../logic/insights.js';

// ---- Mutable state ----

let activeTab = $state<TabId>(DEFAULT_TAB);
let wizardStep = $state(DEFAULT_WIZARD_STEP);
let constraintAnswers = $state<ConstraintAnswers>({});
let tcoInputs = $state<TCOInputs>({ ...defaultTCOInputs });
let assumptions = $state<Record<MethodId, MethodAssumptions>>(structuredClone(defaultAssumptions));
let selectedMethods = $state<MethodId[]>([...DEFAULT_SELECTED_METHODS]);
let timeHorizonMonths = $state<number>(DEFAULT_TIME_HORIZON);

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
  wizardStep = DEFAULT_WIZARD_STEP;
  constraintAnswers = {};
  tcoInputs = { ...defaultTCOInputs };
  assumptions = structuredClone(defaultAssumptions);
  selectedMethods = [...DEFAULT_SELECTED_METHODS];
  timeHorizonMonths = DEFAULT_TIME_HORIZON;
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
