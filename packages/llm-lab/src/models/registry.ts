// =============================================================================
// Model registry — the single canonical catalog of provider/model combos.
// =============================================================================
//
// MAINTENANCE
//   - Update model ids, pricing, context windows, and capabilities HERE and
//     nowhere else. Demos read this catalog through the helpers in ./index.
//   - For Anthropic ids/pricing, consult the `claude-api` skill (the source of
//     truth) rather than copying ids from other files — that drift is exactly
//     what this registry exists to prevent.
//   - When a model is renamed or retired, keep its old entry, set
//     `deprecated: true` + `replacedBy`, and add the new id. `getModel()` /
//     `resolveModelId()` follow `replacedBy`, so old share-config URLs keep
//     resolving.
//   - Bump PRICING_AS_OF whenever you touch pricing.
//
// To change WHICH models a given demo offers, edit ./demos.ts — not this file.
// =============================================================================

import type { ModelInfo, ProviderId } from '@byo-keys/core';

/** Date the pricing below was last reconciled (USD per 1M tokens). */
export const PRICING_AS_OF = '2026-08-10';

/** Cost/capability tiers, cheapest → most capable. */
export type ModelTier = 'budget' | 'mid' | 'frontier';

export interface RegistryModel extends ModelInfo {
  /** Cost/capability tier — drives tier-based routing (see model-router-lab). */
  tier?: ModelTier;
  /** Recommended default for its provider (exactly one per provider). */
  default?: boolean;
  /** When deprecated/renamed: the live id that supersedes this one. */
  replacedBy?: string;
  // Inherited from ModelInfo: id, name, provider, contextWindow,
  // maxOutputTokens, inputPricePerMillion, outputPricePerMillion,
  // capabilities, deprecated.
}

/** Display names for the providers the demos use. */
export const PROVIDER_NAMES: Partial<Record<ProviderId, string>> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Google',
  openrouter: 'OpenRouter',
  huggingface: 'Hugging Face',
  ollama: 'Ollama (Local)',
};

// Capability shorthands so the table below stays readable.
const CHAT = { chat: true, streaming: true } as const;
const VISION_TOOLS = { ...CHAT, vision: true, functionCalling: true } as const;
const THINKING = { ...VISION_TOOLS, extendedThinking: true } as const;

/**
 * The canonical catalog. Pricing/tiers for Anthropic come from the `claude-api`
 * skill; OpenAI from developers.openai.com/api/docs/pricing and Gemini from
 * ai.google.dev/gemini-api/docs/pricing.
 *
 * SAMPLING-PARAMETER NOTE. The current frontier/mid models on Anthropic and
 * OpenAI (Claude 5.x, GPT-5.x) reject `temperature`/`top_p`/`top_k` — the
 * byo-keys providers strip them for those ids (see `supportsSampling` in
 * @byo-keys/providers). The previous generation (Claude Opus 4.8 / Sonnet 4.6,
 * GPT-4.1, GPT-4o mini) is kept live so demos with a temperature control still
 * have a model where that knob does something.
 */
export const MODELS: RegistryModel[] = [
  // ---- Anthropic ----
  // Claude Fable 5 is deliberately absent: it requires 30-day data retention
  // (ZDR orgs get a 400 on every request) and can return `stop_reason: refusal`,
  // which the byo-keys Anthropic provider does not yet surface as a fallback.
  {
    id: 'claude-opus-5',
    name: 'Claude Opus 5',
    provider: 'anthropic',
    tier: 'frontier',
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    inputPricePerMillion: 5,
    outputPricePerMillion: 25,
    capabilities: THINKING,
  },
  {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    provider: 'anthropic',
    tier: 'mid',
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    inputPricePerMillion: 3,
    outputPricePerMillion: 15,
    capabilities: THINKING,
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    tier: 'budget',
    default: true,
    contextWindow: 200_000,
    maxOutputTokens: 64_000,
    inputPricePerMillion: 1,
    outputPricePerMillion: 5,
    capabilities: THINKING,
  },
  // Previous generation, kept live: these still accept temperature/top_p, so
  // demos built around a sampling control have something to point at.
  {
    id: 'claude-opus-4-8',
    name: 'Claude Opus 4.8',
    provider: 'anthropic',
    tier: 'frontier',
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    inputPricePerMillion: 5,
    outputPricePerMillion: 25,
    capabilities: THINKING,
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    tier: 'mid',
    contextWindow: 1_000_000,
    maxOutputTokens: 64_000,
    inputPricePerMillion: 3,
    outputPricePerMillion: 15,
    capabilities: THINKING,
  },
  // Retired/renamed Anthropic ids the demos used to hardcode. Kept so old
  // share-config URLs and tier tables resolve to a live model.
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5 (dated id)',
    provider: 'anthropic',
    deprecated: true,
    replacedBy: 'claude-haiku-4-5',
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku (retired)',
    provider: 'anthropic',
    deprecated: true,
    replacedBy: 'claude-haiku-4-5',
  },
  {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4 (deprecated)',
    provider: 'anthropic',
    deprecated: true,
    replacedBy: 'claude-opus-5',
  },

  // ---- OpenAI ----
  // The GPT-5.6 family (Sol/Terra/Luna) shares a 1.05M context window and a
  // 128K output cap; `gpt-5.6` aliases to Sol.
  {
    id: 'gpt-5.6-sol',
    name: 'GPT-5.6 Sol',
    provider: 'openai',
    tier: 'frontier',
    contextWindow: 1_050_000,
    maxOutputTokens: 128_000,
    inputPricePerMillion: 5,
    outputPricePerMillion: 30,
    capabilities: THINKING,
  },
  {
    id: 'gpt-5.6-terra',
    name: 'GPT-5.6 Terra',
    provider: 'openai',
    tier: 'mid',
    contextWindow: 1_050_000,
    maxOutputTokens: 128_000,
    inputPricePerMillion: 2,
    outputPricePerMillion: 12,
    capabilities: THINKING,
  },
  {
    id: 'gpt-5.6-luna',
    name: 'GPT-5.6 Luna',
    provider: 'openai',
    tier: 'budget',
    default: true,
    contextWindow: 1_050_000,
    maxOutputTokens: 128_000,
    inputPricePerMillion: 0.2,
    outputPricePerMillion: 1.2,
    capabilities: THINKING,
  },
  // Previous generation, kept live for the same sampling-parameter reason as
  // Claude 4.8/4.6 above.
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    tier: 'mid',
    contextWindow: 1_047_576,
    maxOutputTokens: 32_768,
    inputPricePerMillion: 2,
    outputPricePerMillion: 8,
    capabilities: VISION_TOOLS,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    provider: 'openai',
    tier: 'budget',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.6,
    capabilities: VISION_TOOLS,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o (superseded)',
    provider: 'openai',
    deprecated: true,
    replacedBy: 'gpt-4.1',
  },

  // ---- Google (Gemini) ----
  // Gemini 3.x accepts temperature, so no sampling-parameter caveat here.
  // 3.1 Pro is still preview-only — there is no stable Gemini 3 Pro id yet.
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro (preview)',
    provider: 'gemini',
    tier: 'frontier',
    contextWindow: 1_000_000,
    maxOutputTokens: 64_000,
    inputPricePerMillion: 2,
    outputPricePerMillion: 12,
    capabilities: THINKING,
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    provider: 'gemini',
    tier: 'mid',
    default: true,
    contextWindow: 1_000_000,
    maxOutputTokens: 64_000,
    inputPricePerMillion: 1.5,
    outputPricePerMillion: 7.5,
    capabilities: THINKING,
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite',
    provider: 'gemini',
    tier: 'budget',
    contextWindow: 1_000_000,
    maxOutputTokens: 64_000,
    inputPricePerMillion: 0.3,
    outputPricePerMillion: 2.5,
    capabilities: VISION_TOOLS,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash (superseded)',
    provider: 'gemini',
    deprecated: true,
    replacedBy: 'gemini-3.5-flash-lite',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro (superseded)',
    provider: 'gemini',
    deprecated: true,
    replacedBy: 'gemini-3.1-pro-preview',
  },

  // ---- OpenROUTER (open catalog — curated defaults; ids use OpenRouter's
  //      provider-prefixed slugs. Verify against the live OpenRouter catalog
  //      before relying on any entry other than the default.) ----
  {
    id: 'anthropic/claude-4.5-haiku',
    name: 'Claude 4.5 Haiku (OpenRouter)',
    provider: 'openrouter',
    tier: 'budget',
    default: true,
    capabilities: VISION_TOOLS,
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o (OpenRouter)',
    provider: 'openrouter',
    tier: 'mid',
    capabilities: VISION_TOOLS,
  },
];
