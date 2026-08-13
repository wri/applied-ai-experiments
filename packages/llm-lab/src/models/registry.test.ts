import { describe, it, expect } from 'vitest';
import { MODELS } from './registry';
import { DEMO_MODEL_SETS } from './demos';
import {
  allModels,
  modelsByProvider,
  getModel,
  resolveModelId,
  tierModel,
  modelsForDemo,
  modelSelectorConfigForDemo,
  defaultModelForDemo,
} from './index';

describe('catalog integrity', () => {
  it('has no duplicate ids', () => {
    const ids = MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every replacedBy points at a real, live id', () => {
    for (const m of MODELS) {
      if (!m.replacedBy) continue;
      const target = MODELS.find((x) => x.id === m.replacedBy);
      expect(target, `${m.id} -> ${m.replacedBy}`).toBeDefined();
      expect(target!.deprecated, `${m.replacedBy} is deprecated`).not.toBe(true);
    }
  });

  it('has at most one default per provider', () => {
    const byProvider = new Map<string, number>();
    for (const m of MODELS.filter((x) => x.default)) {
      byProvider.set(m.provider, (byProvider.get(m.provider) ?? 0) + 1);
    }
    for (const [provider, count] of byProvider) {
      expect(count, `${provider} has ${count} defaults`).toBe(1);
    }
  });

  it('excludes deprecated models by default', () => {
    expect(allModels().some((m) => m.deprecated)).toBe(false);
    expect(allModels({ includeDeprecated: true }).some((m) => m.deprecated)).toBe(true);
  });

  it('every live model carries a tier', () => {
    for (const m of allModels()) {
      expect(m.tier, `${m.id} tier`).toBeDefined();
    }
  });

  it('fully-curated providers carry pricing (openrouter/hf are open catalogs)', () => {
    const CURATED: string[] = ['anthropic', 'openai', 'gemini'];
    for (const m of allModels().filter((x) => CURATED.includes(x.provider))) {
      expect(m.inputPricePerMillion, `${m.id} input price`).toBeTypeOf('number');
      expect(m.outputPricePerMillion, `${m.id} output price`).toBeTypeOf('number');
    }
  });
});

describe('resolution helpers', () => {
  it('getModel follows replacedBy to a live model', () => {
    const resolved = getModel('claude-3-5-haiku-20241022');
    expect(resolved?.id).toBe('claude-haiku-4-5');
    expect(resolved?.deprecated).not.toBe(true);
  });

  it('getModel returns undefined for unknown ids', () => {
    expect(getModel('does-not-exist')).toBeUndefined();
  });

  it('resolveModelId maps a retired id to its live successor', () => {
    expect(resolveModelId('claude-opus-4-20250514')).toBe('claude-opus-5');
    expect(resolveModelId('unknown-id')).toBe('unknown-id');
  });

  it('tierModel returns live ids by exact tier', () => {
    expect(tierModel('anthropic', 'frontier')).toBe('claude-opus-5');
    expect(tierModel('anthropic', 'budget')).toBe('claude-haiku-4-5');
    expect(tierModel('openai', 'frontier')).toBe('gpt-5.6-sol');
    // openrouter curates budget + mid only → falls back
    expect(tierModel('openrouter', 'frontier', 'fallback-id')).toBe('fallback-id');
    expect(modelsByProvider('gemini').length).toBeGreaterThan(0);
  });
});

describe('per-demo model sets', () => {
  it('every demo resolves to at least one live model', () => {
    for (const slug of Object.keys(DEMO_MODEL_SETS)) {
      expect(modelsForDemo(slug).length, `${slug} has no models`).toBeGreaterThan(0);
    }
  });

  it('every demo provider has catalog entries or is marked dynamic', () => {
    const known = new Set(MODELS.map((m) => m.provider));
    for (const [slug, set] of Object.entries(DEMO_MODEL_SETS)) {
      for (const p of set.providers ?? []) {
        const ok = known.has(p) || (set.dynamicProviders?.includes(p) ?? false);
        expect(ok, `${slug} provider ${p}: no catalog entries and not dynamic`).toBe(true);
      }
      // dynamicProviders must be a subset of providers
      for (const p of set.dynamicProviders ?? []) {
        expect(set.providers?.includes(p), `${slug} dynamicProvider ${p} not in providers`).toBe(
          true
        );
      }
    }
  });

  it('builds a selector config whose curated default is in the curated list', () => {
    for (const slug of Object.keys(DEMO_MODEL_SETS)) {
      const config = modelSelectorConfigForDemo(slug);
      for (const [providerId, providerConfig] of Object.entries(config.providers)) {
        const def = providerConfig!.defaultModel;
        // A curated default must be present in the curated list.
        if (def !== undefined) {
          expect(
            providerConfig!.models.some((m) => m.id === def),
            `${slug}/${providerId} default ${def} not in curated list`
          ).toBe(true);
        }
        // Curated-only providers must offer at least one model with a default;
        // live-only (allowDynamic) providers may have empty curated lists.
        if (!providerConfig!.allowDynamic) {
          expect(providerConfig!.models.length, `${slug}/${providerId} curated`).toBeGreaterThan(0);
          expect(def, `${slug}/${providerId} default`).toBeDefined();
        }
      }
    }
  });

  it('marks prompt-comparator open catalogs as allowDynamic', () => {
    const { providers } = modelSelectorConfigForDemo('prompt-comparator');
    expect(providers.openrouter?.allowDynamic).toBe(true);
    expect(providers.huggingface?.allowDynamic).toBe(true);
    expect(providers.anthropic?.allowDynamic).not.toBe(true);
    // huggingface is live-only here — curated list is empty but it still appears.
    expect(providers.huggingface).toBeDefined();
  });

  it('honours a capability filter (structured-output-lab requires functionCalling)', () => {
    for (const m of modelsForDemo('structured-output-lab')) {
      expect(m.capabilities?.functionCalling, m.id).toBe(true);
    }
  });

  it('defaultModelForDemo returns a model offered by the demo', () => {
    const def = defaultModelForDemo('ask-ten-times', 'anthropic');
    const ids = modelsForDemo('ask-ten-times').map((m) => m.id);
    expect(ids).toContain(def);
  });
});
