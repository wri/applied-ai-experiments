// ---- Method IDs ----

export type MethodId =
  | 'byok'
  | 'provider_direct'
  | 'managed_router'
  | 'self_built_proxy'
  | 'managed_inference'
  | 'full_self_hosted'
  | 'edge_browser'
  | 'hybrid';

export const ALL_METHOD_IDS: MethodId[] = [
  'byok',
  'provider_direct',
  'managed_router',
  'self_built_proxy',
  'managed_inference',
  'full_self_hosted',
  'edge_browser',
  'hybrid',
];

// ---- Delivery Methods ----

export interface MethodCharacteristics {
  costToWRI: 'none' | 'per-token' | 'per-token-plus-markup' | 'per-token-plus-infra' | 'infrastructure' | 'variable';
  costToUser: 'none' | 'full' | 'device-compute' | 'partial';
  setupComplexity: 'low' | 'medium' | 'high';
  operationalBurden: 'none' | 'low' | 'medium' | 'high';
  maxCapability: 'frontier' | 'strong' | 'adequate';
  typicalLatency: { min: number; max: number };
  offlineCapable: boolean;
  dataLeavesDevice: boolean;
  dataLeavesWRI: boolean;
  queryVisibility: 'none' | 'limited' | 'full' | 'partial';
  customGuardrails: 'none' | 'limited' | 'app-level' | 'full';
  vendorLockIn: 'none' | 'low' | 'medium' | 'high';
  multiProvider: boolean;
}

export interface DeliveryMethod {
  id: MethodId;
  name: string;
  shortName: string;
  category: string;
  tagline: string;
  description: string;
  bestFor: string[];
  redFlags: string[];
  exampleServices: string;
  characteristics: MethodCharacteristics;
}

// ---- Constraints ----

export type ConstraintId = 'budget' | 'privacy' | 'capability' | 'latency' | 'reliability';

export const ALL_CONSTRAINT_IDS: ConstraintId[] = [
  'budget',
  'privacy',
  'capability',
  'latency',
  'reliability',
];

export type Viability = 'viable' | 'caution' | 'eliminated';

export interface ConstraintOption {
  id: string;
  label: string;
  description: string;
  viabilityRules: Partial<Record<MethodId, { viability: Viability; reason: string }>>;
}

export interface ConstraintQuestion {
  id: ConstraintId;
  title: string;
  description: string;
  options: ConstraintOption[];
}

export type ConstraintAnswers = Partial<Record<ConstraintId, string>>;

// ---- Viability result ----

export interface MethodViability {
  viability: Viability;
  reasons: string[];
  cautionCount: number;
  eliminatedCount: number;
}

// ---- TCO ----

export interface TCOInputs {
  monthlyVolume: number;
  avgInputTokens: number;
  avgOutputTokens: number;
}

export interface MethodAssumptions {
  // Token pricing (per million)
  inputTokenPricePerMillion: number;
  outputTokenPricePerMillion: number;
  routerMarkupPercent: number;
  // Infrastructure
  monthlyInfraCost: number;
  // Development
  devHoursInitial: number;
  devHourlyRate: number;
  amortizationMonths: number;
  // Operations
  opsHoursMonthly: number;
  opsHourlyRate: number;
}

export interface TCOBreakdown {
  inference: number;
  infrastructure: number;
  development: number;
  operations: number;
  total: number;
}

export interface MethodTCO {
  methodId: MethodId;
  breakdown: TCOBreakdown;
  costPerRequest: number;
}

export interface TCOBreakdownExpanded {
  upfront: number;
  monthlyInference: number;
  monthlyInfrastructure: number;
  monthlyOperations: number;
  monthlyRecurring: number;
  periodTotal: number;
  monthly: TCOBreakdown;
}

export interface MethodTCOExpanded extends MethodTCO {
  expanded: TCOBreakdownExpanded;
}

// ---- Comparison ----

export interface ComparisonDimension {
  id: string;
  label: string;
  category: string;
  getValue: (method: DeliveryMethod) => string | number | boolean;
  format?: (value: any, colId?: string, method?: DeliveryMethod) => string;
  sentiment?: (value: any) => 'positive' | 'negative' | 'neutral';
}

// ---- App State ----

export type TabId = 'wizard' | 'calculator' | 'compare' | 'guide';

export interface AppState {
  activeTab: TabId;
  wizardStep: number;
  constraintAnswers: ConstraintAnswers;
  tcoInputs: TCOInputs;
  assumptions: Record<MethodId, MethodAssumptions>;
  selectedMethods: MethodId[];
}
