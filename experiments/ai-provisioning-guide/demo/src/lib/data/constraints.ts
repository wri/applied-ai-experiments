import type { ConstraintQuestion } from '../types.js';

/**
 * 5 constraint questions that drive the wizard.
 * Each option includes viability rules: methods not listed default to 'viable'.
 */
export const constraintQuestions: ConstraintQuestion[] = [
  // ---- 1. Budget ----
  {
    id: 'budget',
    title: 'Who pays for inference?',
    description:
      'The funding model is often the strongest filter. It determines which methods are even possible.',
    options: [
      {
        id: 'user_pays',
        label: 'Users pay entirely',
        description: 'End-users provide their own API keys or credits',
        viabilityRules: {
          provider_direct: { viability: 'eliminated', reason: 'WRI would bear the cost' },
          managed_router: { viability: 'eliminated', reason: 'WRI would bear the cost' },
          self_built_proxy: { viability: 'eliminated', reason: 'WRI would bear infra + token cost' },
          managed_inference: { viability: 'eliminated', reason: 'WRI would bear the cost' },
          full_self_hosted: { viability: 'eliminated', reason: 'WRI would bear infrastructure cost' },
          edge_browser: { viability: 'caution', reason: 'Viable but user bears device compute cost' },
          hybrid: { viability: 'caution', reason: 'Cloud component still costs WRI' },
        },
      },
      {
        id: 'wri_low',
        label: 'WRI pays — low volume (<10K/mo)',
        description: 'Grant or project budget covers modest usage',
        viabilityRules: {
          full_self_hosted: { viability: 'caution', reason: 'Infrastructure cost disproportionate at low volume' },
          self_built_proxy: { viability: 'caution', reason: 'Over-engineering for low volume' },
          hybrid: { viability: 'caution', reason: 'Unnecessary complexity at low volume' },
        },
      },
      {
        id: 'wri_medium',
        label: 'WRI pays — medium volume (10K–100K/mo)',
        description: 'Significant but manageable per-token spend',
        viabilityRules: {
          byok: { viability: 'caution', reason: 'WRI paying — BYOK shifts cost to users' },
          full_self_hosted: { viability: 'caution', reason: 'May not hit break-even at this volume' },
        },
      },
      {
        id: 'wri_high',
        label: 'WRI pays — high volume (>100K/mo)',
        description: 'Per-token cost optimization becomes critical',
        viabilityRules: {
          byok: { viability: 'eliminated', reason: 'Cannot push this volume onto users' },
          managed_router: { viability: 'caution', reason: 'Router markup hurts at scale' },
        },
      },
    ],
  },

  // ---- 2. Privacy ----
  {
    id: 'privacy',
    title: 'Where can data go?',
    description:
      'Data sensitivity determines which methods are acceptable. Consider the most sensitive data that will be processed.',
    options: [
      {
        id: 'device_only',
        label: 'Data cannot leave the device',
        description: 'Strictest privacy — all processing on-device',
        viabilityRules: {
          byok: { viability: 'eliminated', reason: 'Sends data to external API' },
          provider_direct: { viability: 'eliminated', reason: 'Sends data to external API' },
          managed_router: { viability: 'eliminated', reason: 'Sends data to external API via router' },
          self_built_proxy: { viability: 'eliminated', reason: 'Sends data to external API' },
          managed_inference: { viability: 'eliminated', reason: 'Sends data to managed service' },
          full_self_hosted: { viability: 'eliminated', reason: 'Data leaves device to WRI servers' },
          hybrid: { viability: 'caution', reason: 'Only the edge component works offline' },
        },
      },
      {
        id: 'wri_only',
        label: 'Data cannot leave WRI infrastructure',
        description: 'Data stays within WRI-controlled servers',
        viabilityRules: {
          byok: { viability: 'eliminated', reason: 'Data goes to user-selected provider' },
          provider_direct: { viability: 'eliminated', reason: 'Data goes to external provider' },
          managed_router: { viability: 'eliminated', reason: 'Data goes to router + provider' },
          managed_inference: { viability: 'eliminated', reason: 'Data goes to managed service' },
          self_built_proxy: { viability: 'caution', reason: 'Proxy is WRI-controlled but upstream provider is not' },
          hybrid: { viability: 'caution', reason: 'Cloud routing must stay within WRI infra' },
        },
      },
      {
        id: 'trusted_providers',
        label: 'Trusted providers with DPA are OK',
        description: 'Data can go to providers with a data processing agreement',
        viabilityRules: {
          managed_router: { viability: 'caution', reason: 'Verify router provider has DPA' },
        },
      },
      {
        id: 'no_restrictions',
        label: 'No special restrictions',
        description: 'Standard data handling is sufficient',
        viabilityRules: {},
      },
    ],
  },

  // ---- 3. Capability ----
  {
    id: 'capability',
    title: 'What quality level is required?',
    description:
      'The required model capability affects which delivery methods can meet your needs.',
    options: [
      {
        id: 'frontier',
        label: 'Frontier (complex reasoning, 100K+ context)',
        description: 'Best available models for hard tasks — Claude Opus, GPT-4o, Gemini Pro',
        viabilityRules: {
          managed_inference: { viability: 'eliminated', reason: 'Open models only — no frontier access' },
          full_self_hosted: { viability: 'eliminated', reason: 'Open models only — no frontier access' },
          edge_browser: { viability: 'eliminated', reason: 'Small models only — cannot match frontier' },
        },
      },
      {
        id: 'strong',
        label: 'Strong (good reasoning, 8–32K context)',
        description: 'Capable models — Sonnet, Haiku, Llama 70B, Mixtral',
        viabilityRules: {
          edge_browser: { viability: 'eliminated', reason: 'Small models cannot match "strong" quality' },
        },
      },
      {
        id: 'adequate',
        label: 'Adequate (classification, extraction, simple tasks)',
        description: 'Small/medium models work — Phi-3, Gemma, Llama 8B',
        viabilityRules: {},
      },
      {
        id: 'minimal',
        label: 'Minimal (templates, formatting, keyword matching)',
        description: 'Consider whether you even need an LLM',
        viabilityRules: {},
      },
    ],
  },

  // ---- 4. Latency ----
  {
    id: 'latency',
    title: 'How fast must responses be?',
    description:
      'Latency requirements can eliminate methods that add network hops or require cold starts.',
    options: [
      {
        id: 'realtime',
        label: 'Real-time (<100ms)',
        description: 'Inline suggestions, autocomplete, keystroke-level',
        viabilityRules: {
          byok: { viability: 'eliminated', reason: 'Cloud round-trip too slow' },
          provider_direct: { viability: 'eliminated', reason: 'Cloud round-trip too slow' },
          managed_router: { viability: 'eliminated', reason: 'Cloud round-trip + routing too slow' },
          self_built_proxy: { viability: 'eliminated', reason: 'Cloud round-trip + proxy too slow' },
          managed_inference: { viability: 'caution', reason: 'Possible with small models and warm endpoints' },
          full_self_hosted: { viability: 'caution', reason: 'Possible with optimized small models' },
          hybrid: { viability: 'caution', reason: 'Only edge component meets this bar' },
        },
      },
      {
        id: 'snappy',
        label: 'Snappy (<500ms)',
        description: 'Interactive UI — feels responsive',
        viabilityRules: {
          managed_router: { viability: 'caution', reason: 'Router hop adds latency' },
          self_built_proxy: { viability: 'caution', reason: 'Proxy hop adds latency' },
        },
      },
      {
        id: 'conversational',
        label: 'Conversational (<2s)',
        description: 'Chat-style interaction — acceptable wait',
        viabilityRules: {},
      },
      {
        id: 'async',
        label: 'Async / batch OK (>2s)',
        description: 'Background processing, reports, batch jobs',
        viabilityRules: {},
      },
    ],
  },

  // ---- 5. Reliability ----
  {
    id: 'reliability',
    title: 'What availability is required?',
    description:
      'Consider offline needs, uptime requirements, and how critical AI is to your product.',
    options: [
      {
        id: 'offline',
        label: 'Must work offline',
        description: 'No internet connection available in the field',
        viabilityRules: {
          byok: { viability: 'eliminated', reason: 'Requires internet' },
          provider_direct: { viability: 'eliminated', reason: 'Requires internet' },
          managed_router: { viability: 'eliminated', reason: 'Requires internet' },
          self_built_proxy: { viability: 'eliminated', reason: 'Requires internet' },
          managed_inference: { viability: 'eliminated', reason: 'Requires internet' },
          full_self_hosted: { viability: 'eliminated', reason: 'Requires network to WRI servers' },
          hybrid: { viability: 'caution', reason: 'Only edge component works offline' },
        },
      },
      {
        id: 'high_uptime',
        label: '99.9%+ uptime critical',
        description: 'Production system — outages are unacceptable',
        viabilityRules: {
          byok: { viability: 'caution', reason: "Reliability depends on user's provider" },
          provider_direct: { viability: 'caution', reason: 'Single provider = single point of failure' },
          managed_inference: { viability: 'caution', reason: 'Single provider = single point of failure' },
          full_self_hosted: { viability: 'caution', reason: 'Requires robust ops — GPU failures, scaling' },
        },
      },
      {
        id: 'graceful_degradation',
        label: 'Graceful degradation OK',
        description: 'AI can be unavailable sometimes with fallback behavior',
        viabilityRules: {},
      },
      {
        id: 'best_effort',
        label: 'Best effort',
        description: 'Internal tool — occasional downtime is fine',
        viabilityRules: {},
      },
    ],
  },
];

export const constraintsById = new Map(constraintQuestions.map((q) => [q.id, q]));
