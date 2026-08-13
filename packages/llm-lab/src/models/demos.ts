// =============================================================================
// Per-demo model sets — the central place to manage WHAT each demo offers.
// =============================================================================
//
// Each demo names only its own slug; this map decides which slice of the
// catalog (registry.ts) it gets. One demo can expose only cheap/fast models,
// another only vision-capable models, another only thinking models — change it
// here, in one file, without touching demo code. Deprecating a model in
// registry.ts still drops it from every demo automatically.
//
// Filters compose (a model must satisfy ALL provided constraints). `include`
// is an explicit allow-list that overrides the filters; `exclude` removes ids.
// =============================================================================

import type { ProviderId, ProviderCapabilities } from '@byo-keys/core';
import type { ModelTier, RegistryModel } from './registry';

export interface DemoModelSet {
  /** Providers this demo offers, in selector order. Omit = all providers. */
  providers?: ProviderId[];
  /** Restrict to these tiers, e.g. ['budget'] for cheap/fast only. */
  tiers?: ModelTier[];
  /** Require ALL of these capabilities, e.g. ['vision'] or ['extendedThinking']. */
  capabilities?: (keyof ProviderCapabilities)[];
  /** Explicit allow-list of model ids — wins over the filters above. */
  include?: string[];
  /** Explicit deny-list of model ids. */
  exclude?: string[];
  /** Escape hatch for anything the declarative fields can't express. */
  filter?: (m: RegistryModel) => boolean;
  /** Per-provider default override (id). Falls back to the catalog default. */
  defaults?: Partial<Record<ProviderId, string>>;
  /**
   * Providers whose selector list should ALSO include models discovered live
   * from the provider API, merged after the curated registry entries. Use for
   * open catalogs (OpenRouter, Hugging Face) that need a curated default plus
   * full live discovery. A provider listed here with no catalog entries shows
   * live models only. Must also appear in `providers`.
   */
  dynamicProviders?: ProviderId[];
}

/**
 * The per-demo selection map, keyed by experiment slug. The filters below are
 * starting points — adjust freely; this is the knob for each demo's offering.
 *
 * Note: openrouter/huggingface are open catalogs. registry.ts curates a small
 * subset (curated defaults + deprecation management); list them in
 * `dynamicProviders` to ALSO surface full live discovery in the selector.
 */
export const DEMO_MODEL_SETS: Record<string, DemoModelSet> = {
  'prompt-comparator': {
    // Curated for closed catalogs; curated default + live discovery for the
    // open ones, so this comparison tool keeps access to arbitrary models.
    // Ollama is live-only (no catalog entries): whatever the user has pulled.
    providers: ['anthropic', 'openai', 'gemini', 'openrouter', 'huggingface', 'ollama'],
    dynamicProviders: ['openrouter', 'huggingface', 'ollama'],
  },
  'concept-map': {
    providers: ['anthropic', 'openai', 'gemini', 'ollama'],
    dynamicProviders: ['ollama'],
  },
  'ask-ten-times': {
    providers: ['anthropic', 'openai', 'gemini', 'ollama'],
    dynamicProviders: ['ollama'],
    // This demo is built around a temperature control, and the Claude 5.x /
    // GPT-5.x models only accept the default temperature (the providers strip
    // the parameter rather than 400). Default to models where the knob bites;
    // the newer ones stay selectable.
    defaults: { anthropic: 'claude-opus-4-8', openai: 'gpt-4.1' },
  },
  'structured-output-lab': {
    // Note: the capability filter applies to curated catalog entries only;
    // live-discovered Ollama models are surfaced regardless, and local-model
    // tool/JSON-mode support varies — structured output may be unreliable.
    providers: ['anthropic', 'openai', 'gemini', 'ollama'],
    dynamicProviders: ['ollama'],
    capabilities: ['functionCalling'],
  },
  'model-router-lab': {
    providers: ['anthropic', 'openai', 'gemini', 'ollama'],
    dynamicProviders: ['ollama'],
  },
  'mcp-web-map': {
    providers: ['anthropic', 'gemini', 'openrouter', 'ollama'],
    dynamicProviders: ['ollama'],
    capabilities: ['functionCalling'],
  },
  'ai-web-map-exploration': {
    // Anthropic-first (all 19 probes target Claude); Ollama offered as an
    // optional keyless local provider, live-discovered.
    providers: ['anthropic', 'ollama'],
    dynamicProviders: ['ollama'],
  },
  // Templates for future demos:
  // 'image-describer': { capabilities: ['vision'] },
  // 'reasoning-lab':   { capabilities: ['extendedThinking'] },
};
