// =============================================================================
// @wri-datalab/llm-lab/models — central model registry + per-demo selection.
// =============================================================================
//
// Usage:
//   import {
//     modelSelectorConfigForDemo, defaultModelForDemo, getModel, tierModel,
//   } from '@wri-datalab/llm-lab/models';
//
//   <ModelSelector config={modelSelectorConfigForDemo('ask-ten-times')} ... />
//
// Catalog lives in ./registry; per-demo offerings live in ./demos.
// =============================================================================

import type { ProviderId } from '@byo-keys/core';
import type { ModelSelectorConfig, ProviderConfig } from '@wri-datalab/ui';
import {
  MODELS,
  PROVIDER_NAMES,
  PRICING_AS_OF,
  type ModelTier,
  type RegistryModel,
} from './registry';
import { DEMO_MODEL_SETS, type DemoModelSet } from './demos';

export {
  MODELS,
  PROVIDER_NAMES,
  PRICING_AS_OF,
  DEMO_MODEL_SETS,
  type ModelTier,
  type RegistryModel,
  type DemoModelSet,
};

/**
 * Shown in the selector when Ollama has no models — i.e. it couldn't be reached.
 * Ollama is HTTP/localhost-only, so the deployed HTTPS site can't talk to it.
 */
const OLLAMA_EMPTY_NOTE =
  'No local models found. Start Ollama and pull a model ' +
  '(e.g. `ollama run llama3.2`). The deployed site (HTTPS) cannot reach ' +
  'http://localhost:11434 — run the demo locally to use Ollama.';

export interface AllModelsOptions {
  /** Include models marked `deprecated`. Default: false. */
  includeDeprecated?: boolean;
}

const isLive = (m: RegistryModel): boolean => !m.deprecated;

/** The catalog, excluding deprecated models by default. */
export function allModels(opts: AllModelsOptions = {}): RegistryModel[] {
  return opts.includeDeprecated ? [...MODELS] : MODELS.filter(isLive);
}

/** Catalog entries for one provider (excludes deprecated by default). */
export function modelsByProvider(
  providerId: ProviderId,
  opts: AllModelsOptions = {}
): RegistryModel[] {
  return allModels(opts).filter((m) => m.provider === providerId);
}

/**
 * Look up a model by id, following `replacedBy` so a deprecated/renamed id
 * resolves to the live model that supersedes it. Returns undefined if unknown.
 */
export function getModel(id: string, seen: Set<string> = new Set()): RegistryModel | undefined {
  if (seen.has(id)) return undefined; // guard against a replacedBy cycle
  seen.add(id);
  const entry = MODELS.find((m) => m.id === id);
  if (!entry) return undefined;
  if (entry.replacedBy) return getModel(entry.replacedBy, seen) ?? entry;
  return entry;
}

/** The live id a (possibly deprecated) id resolves to. Returns the input if unknown. */
export function resolveModelId(id: string): string {
  return getModel(id)?.id ?? id;
}

/**
 * The live model id for a provider at an exact tier, or `fallback` if the
 * provider has no model at that tier. (model-router-lab maps its cheap/strong
 * vocabulary onto these tiers — see that demo's lib/models.ts.)
 */
export function tierModel(
  providerId: ProviderId,
  tier: ModelTier,
  fallback?: string
): string | undefined {
  const match = modelsByProvider(providerId).find((m) => m.tier === tier);
  return match?.id ?? fallback;
}

// --- per-demo selection --------------------------------------------------

function resolveDemoSet(slug: string): DemoModelSet {
  const set = DEMO_MODEL_SETS[slug];
  if (!set) {
    if (typeof console !== 'undefined') {
      console.warn(
        `[llm-lab/models] no DEMO_MODEL_SETS entry for "${slug}"; offering all models.`
      );
    }
    return {};
  }
  return set;
}

function matchesSet(model: RegistryModel, set: DemoModelSet): boolean {
  if (set.include) return set.include.includes(model.id);
  if (set.providers && !set.providers.includes(model.provider)) return false;
  if (set.tiers && (!model.tier || !set.tiers.includes(model.tier))) return false;
  if (set.capabilities && !set.capabilities.every((c) => model.capabilities?.[c] === true)) {
    return false;
  }
  return true;
}

/** The catalog slice a demo offers, after applying its DemoModelSet filter. */
export function modelsForDemo(slug: string): RegistryModel[] {
  const set = resolveDemoSet(slug);
  return allModels().filter(
    (m) =>
      matchesSet(m, set) && !set.exclude?.includes(m.id) && (set.filter ? set.filter(m) : true)
  );
}

/**
 * Build the static `ModelSelectorConfig` for a demo's `<ModelSelector config={…}>`.
 * Providers appear in the order declared in the demo's DemoModelSet.
 */
export function modelSelectorConfigForDemo(slug: string): ModelSelectorConfig {
  const set = resolveDemoSet(slug);
  const models = modelsForDemo(slug);
  const providerOrder =
    set.providers ?? [...new Set(models.map((m) => m.provider))];

  const providers: ModelSelectorConfig['providers'] = {};
  for (const providerId of providerOrder) {
    const forProvider = models.filter((m) => m.provider === providerId);
    const allowDynamic = set.dynamicProviders?.includes(providerId) ?? false;
    // Skip a provider only when it has neither curated entries nor live discovery.
    if (!forProvider.length && !allowDynamic) continue;
    const config: ProviderConfig = {
      name: PROVIDER_NAMES[providerId] ?? String(providerId),
      models: forProvider,
      defaultModel: defaultModelForDemo(slug, providerId),
      ...(allowDynamic ? { allowDynamic: true } : {}),
      ...(providerId === 'ollama' ? { emptyNote: OLLAMA_EMPTY_NOTE } : {}),
    };
    providers[providerId] = config;
  }
  return { providers };
}

/** The default model id for a provider within a demo's offering. */
export function defaultModelForDemo(slug: string, providerId: ProviderId): string | undefined {
  const set = resolveDemoSet(slug);
  const forProvider = modelsForDemo(slug).filter((m) => m.provider === providerId);
  const override = set.defaults?.[providerId];
  if (override && forProvider.some((m) => m.id === override)) return override;
  return forProvider.find((m) => m.default)?.id ?? forProvider[0]?.id;
}
