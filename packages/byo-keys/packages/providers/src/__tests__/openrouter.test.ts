import { describe, it, expect, vi } from 'vitest';
import { openrouter } from '../openrouter';

const MODELS_FIXTURE = {
  data: [
    {
      id: 'anthropic/claude-sonnet-4',
      name: 'Anthropic: Claude Sonnet 4',
      context_length: 200000,
      pricing: { prompt: '0.000003', completion: '0.000015' },
      top_provider: {
        is_moderated: true,
        context_length: 200000,
        max_completion_tokens: 64000,
      },
    },
    {
      id: 'openrouter/auto',
      name: 'Auto Router',
      context_length: 2000000,
      pricing: { prompt: '-1', completion: '-1' },
    },
    {
      id: 'meta-llama/llama-3.3-70b-instruct:free',
      name: 'Meta: Llama 3.3 70B (free)',
      context_length: 131072,
      pricing: { prompt: '0', completion: '0' },
    },
  ],
};

function createFetchMock(body: unknown) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  ) as unknown as typeof fetch;
}

describe('OpenRouterProvider', () => {
  it('exposes an apiKeyUrl in its config', () => {
    expect(openrouter().config.apiKeyUrl).toBe('https://openrouter.ai/keys');
  });

  it('converts per-token pricing strings to USD per million tokens', async () => {
    const provider = openrouter({ fetch: createFetchMock(MODELS_FIXTURE) });
    provider.initialize('sk-or-test');

    const models = await provider.listModels();

    const claude = models[0];
    expect(claude.inputPricePerMillion).toBeCloseTo(3);
    expect(claude.outputPricePerMillion).toBeCloseTo(15);
    expect(claude.contextWindow).toBe(200000);
    expect(claude.maxOutputTokens).toBe(64000);

    // "-1" marks dynamic pricing and must not become a negative price
    const auto = models[1];
    expect(auto.inputPricePerMillion).toBeUndefined();
    expect(auto.outputPricePerMillion).toBeUndefined();
    expect(auto.maxOutputTokens).toBeUndefined();

    // Free models keep an explicit zero price
    const free = models[2];
    expect(free.inputPricePerMillion).toBe(0);
    expect(free.outputPricePerMillion).toBe(0);
  });
});
