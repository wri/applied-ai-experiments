import type { ComparisonDimension, DeliveryMethod } from '../types.js';

const costLabels: Record<string, string> = {
  'none': 'None',
  'per-token': 'Per-token',
  'per-token-plus-markup': 'Per-token + markup',
  'per-token-plus-infra': 'Per-token + infra',
  'infrastructure': 'Infrastructure',
  'variable': 'Variable',
  'full': 'Full (user)',
  'device-compute': 'Device compute',
  'partial': 'Partial',
};

const complexityLabels: Record<string, string> = {
  'low': 'Low',
  'medium': 'Medium',
  'high': 'High',
  'none': 'None',
};

const capabilityLabels: Record<string, string> = {
  'frontier': 'Frontier',
  'strong': 'Strong',
  'adequate': 'Adequate',
};

export const comparisonDimensions: ComparisonDimension[] = [
  // Operational
  {
    id: 'costToWRI',
    label: 'Cost to WRI',
    category: 'Operational',
    getValue: (m: DeliveryMethod) => m.characteristics.costToWRI,
    format: (v: string) => costLabels[v] ?? v,
    sentiment: (v: string) => (v === 'none' ? 'positive' : v === 'infrastructure' || v === 'variable' ? 'negative' : 'neutral'),
  },
  {
    id: 'setupComplexity',
    label: 'Setup Complexity',
    category: 'Operational',
    getValue: (m: DeliveryMethod) => m.characteristics.setupComplexity,
    format: (v: string) => complexityLabels[v] ?? v,
    sentiment: (v: string) => (v === 'low' ? 'positive' : v === 'high' ? 'negative' : 'neutral'),
  },
  {
    id: 'operationalBurden',
    label: 'Ops Burden',
    category: 'Operational',
    getValue: (m: DeliveryMethod) => m.characteristics.operationalBurden,
    format: (v: string) => complexityLabels[v] ?? v,
    sentiment: (v: string) => (v === 'none' || v === 'low' ? 'positive' : v === 'high' ? 'negative' : 'neutral'),
  },
  {
    id: 'latency',
    label: 'Typical Latency',
    category: 'Operational',
    getValue: (m: DeliveryMethod) => m.characteristics.typicalLatency.min,
    format: (_v: number, _colId?: string, m?: DeliveryMethod) => {
      if (!m) return String(_v);
      return `${m.characteristics.typicalLatency.min}–${m.characteristics.typicalLatency.max}ms`;
    },
    sentiment: (v: number) => (v <= 100 ? 'positive' : v >= 300 ? 'negative' : 'neutral'),
  },

  // Control
  {
    id: 'queryVisibility',
    label: 'Query Visibility',
    category: 'Control',
    getValue: (m: DeliveryMethod) => m.characteristics.queryVisibility,
    format: (v: string) => v.charAt(0).toUpperCase() + v.slice(1),
    sentiment: (v: string) => (v === 'full' ? 'positive' : v === 'none' ? 'negative' : 'neutral'),
  },
  {
    id: 'customGuardrails',
    label: 'Custom Guardrails',
    category: 'Control',
    getValue: (m: DeliveryMethod) => m.characteristics.customGuardrails,
    format: (v: string) => {
      const labels: Record<string, string> = { none: 'None', limited: 'Limited', 'app-level': 'App-level', full: 'Full' };
      return labels[v] ?? v;
    },
    sentiment: (v: string) => (v === 'full' ? 'positive' : v === 'none' ? 'negative' : 'neutral'),
  },
  {
    id: 'multiProvider',
    label: 'Multi-Provider',
    category: 'Control',
    getValue: (m: DeliveryMethod) => m.characteristics.multiProvider,
  },

  // Capability
  {
    id: 'maxCapability',
    label: 'Max Capability',
    category: 'Capability',
    getValue: (m: DeliveryMethod) => m.characteristics.maxCapability,
    format: (v: string) => capabilityLabels[v] ?? v,
    sentiment: (v: string) => (v === 'frontier' ? 'positive' : v === 'adequate' ? 'negative' : 'neutral'),
  },
  {
    id: 'offlineCapable',
    label: 'Offline Capable',
    category: 'Capability',
    getValue: (m: DeliveryMethod) => m.characteristics.offlineCapable,
  },

  // Risk
  {
    id: 'vendorLockIn',
    label: 'Vendor Lock-in',
    category: 'Risk',
    getValue: (m: DeliveryMethod) => m.characteristics.vendorLockIn,
    format: (v: string) => complexityLabels[v] ?? v,
    sentiment: (v: string) => (v === 'none' || v === 'low' ? 'positive' : v === 'high' ? 'negative' : 'neutral'),
  },
  {
    id: 'dataLeavesWRI',
    label: 'Data Leaves WRI',
    category: 'Risk',
    getValue: (m: DeliveryMethod) => m.characteristics.dataLeavesWRI,
    sentiment: (v: boolean) => (v ? 'negative' : 'positive'),
  },
];
