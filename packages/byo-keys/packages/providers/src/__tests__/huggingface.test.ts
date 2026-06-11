import { describe, it, expect, vi } from 'vitest';
import { huggingface } from '../huggingface';

const MODELS_FIXTURE = {
  data: [
    {
      id: 'meta-llama/Llama-3.1-8B-Instruct',
      object: 'model',
      architecture: { input_modalities: ['text'], output_modalities: ['text'] },
      providers: [
        {
          provider: 'cerebras',
          status: 'live',
          context_length: 131072,
          pricing: { input: 0.1, output: 0.2 },
          supports_tools: true,
        },
        {
          provider: 'novita',
          status: 'live',
          context_length: 16384,
          pricing: { input: 0.02, output: 0.05 },
        },
        {
          provider: 'offline-one',
          status: 'offline',
          context_length: 999999,
          pricing: { input: 0, output: 0 },
        },
      ],
    },
    {
      id: 'Qwen/Qwen2.5-VL-7B-Instruct',
      object: 'model',
      architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] },
      providers: [{ provider: 'featherless-ai', status: 'live' }],
    },
  ],
};

const CHAT_FIXTURE = {
  id: 'chatcmpl-1',
  object: 'chat.completion',
  model: 'meta-llama/Llama-3.3-70B-Instruct',
  choices: [
    { index: 0, message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' },
  ],
  usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createFetchMock(handler: (url: string, init?: RequestInit) => Response) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init)
  ) as unknown as typeof fetch;
}

describe('HuggingFaceProvider', () => {
  it('lists models with max live context, cheapest pricing, and capabilities', async () => {
    const fetchMock = createFetchMock(() => jsonResponse(MODELS_FIXTURE));
    const provider = huggingface({ fetch: fetchMock });
    provider.initialize('hf_test');

    const models = await provider.listModels();

    expect(models).toHaveLength(2);

    const llama = models[0];
    expect(llama.id).toBe('meta-llama/Llama-3.1-8B-Instruct');
    expect(llama.provider).toBe('huggingface');
    // Offline provider's context is ignored; max of live ones wins
    expect(llama.contextWindow).toBe(131072);
    // Cheapest live provider's pricing (already USD per 1M tokens)
    expect(llama.inputPricePerMillion).toBe(0.02);
    expect(llama.outputPricePerMillion).toBe(0.05);
    expect(llama.capabilities?.vision).toBe(false);
    expect(llama.capabilities?.functionCalling).toBe(true);

    const qwen = models[1];
    expect(qwen.contextWindow).toBeUndefined();
    expect(qwen.inputPricePerMillion).toBeUndefined();
    expect(qwen.outputPricePerMillion).toBeUndefined();
    expect(qwen.capabilities?.vision).toBe(true);
    expect(qwen.capabilities?.functionCalling).toBe(false);
  });

  it('rejects an invalid key via whoami-v2', async () => {
    const fetchMock = createFetchMock((url) => {
      expect(url).toBe('https://huggingface.co/api/whoami-v2');
      return jsonResponse({ error: 'Invalid username or password.' }, 401);
    });
    const provider = huggingface({ fetch: fetchMock });

    const result = await provider.validateKey('hf_bad');

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('invalid_key');
  });

  it('accepts a valid key and returns models', async () => {
    const fetchMock = createFetchMock((url, init) => {
      if (url === 'https://huggingface.co/api/whoami-v2') {
        expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer hf_good');
        return jsonResponse({ name: 'test-user' });
      }
      expect(url).toBe('https://router.huggingface.co/v1/models');
      return jsonResponse(MODELS_FIXTURE);
    });
    const provider = huggingface({ fetch: fetchMock });

    const result = await provider.validateKey('hf_good');

    expect(result.valid).toBe(true);
    expect(result.models).toHaveLength(2);
    // validateKey must not leave the key set; initialization is the client's job
    expect(provider.isInitialized()).toBe(false);
  });

  it('sends suffixed model ids verbatim to the router chat endpoint', async () => {
    let requestUrl = '';
    let requestBody: any;
    const fetchMock = createFetchMock((url, init) => {
      requestUrl = url;
      requestBody = JSON.parse(String(init?.body));
      return jsonResponse(CHAT_FIXTURE);
    });
    const provider = huggingface({ fetch: fetchMock });
    provider.initialize('hf_test');

    const response = await provider.chat({
      model: 'meta-llama/Llama-3.3-70B-Instruct:cerebras',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(requestUrl).toBe('https://router.huggingface.co/v1/chat/completions');
    expect(requestBody.model).toBe('meta-llama/Llama-3.3-70B-Instruct:cerebras');
    expect(response.content).toBe('hi');
    expect(response.usage.totalTokens).toBe(6);
  });
});
