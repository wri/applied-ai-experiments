// =============================================================================
// OpenRouter Provider
// =============================================================================
// OpenRouter provides access to many models through a unified OpenAI-compatible API.
// It supports CORS for browser-based requests, making it ideal for BYOK apps.

import { OpenAICompatProvider, type OpenAICompatProviderOptions } from './openai-compat';
import type {
  ProviderConfig,
  ProviderCapabilities,
  ModelInfo,
} from '@byo-keys/core';

// -----------------------------------------------------------------------------
// OpenRouter-specific Types
// -----------------------------------------------------------------------------

interface OpenRouterModelsResponse {
  data: Array<{
    id: string;
    name: string;
    description?: string;
    context_length: number;
    pricing: {
      prompt: string;
      completion: string;
    };
    top_provider?: {
      is_moderated: boolean;
      context_length?: number;
      max_completion_tokens?: number;
    };
    per_request_limits?: {
      prompt_tokens?: number;
      completion_tokens?: number;
    };
  }>;
}

// -----------------------------------------------------------------------------
// Provider Options
// -----------------------------------------------------------------------------

export interface OpenRouterProviderOptions extends OpenAICompatProviderOptions {
  /** Optional site URL for OpenRouter attribution */
  siteUrl?: string;
  /** Optional site name for OpenRouter attribution */
  siteName?: string;
}

// -----------------------------------------------------------------------------
// OpenRouter Provider Implementation
// -----------------------------------------------------------------------------

export class OpenRouterProvider extends OpenAICompatProvider {
  readonly config: ProviderConfig = {
    id: 'openrouter',
    name: 'OpenRouter',
    requiresKey: true,
    supportsCORS: true, // OpenRouter supports browser requests
    baseUrl: 'https://openrouter.ai/api',
    apiKeyUrl: 'https://openrouter.ai/keys',
  };

  readonly capabilities: ProviderCapabilities = {
    chat: true,
    streaming: true,
    embeddings: false,
    images: false,
    audio: false,
    vision: true, // Some models support vision
    functionCalling: true,
    extendedThinking: false,
  };

  private openRouterOptions: OpenRouterProviderOptions;

  constructor(options: OpenRouterProviderOptions = {}) {
    super(options);
    this.openRouterOptions = options;
  }

  protected addAuthHeaders(headers: Headers): void {
    super.addAuthHeaders(headers);

    // Add OpenRouter-specific headers
    if (this.openRouterOptions.siteUrl) {
      headers.set('HTTP-Referer', this.openRouterOptions.siteUrl);
    }
    if (this.openRouterOptions.siteName) {
      headers.set('X-Title', this.openRouterOptions.siteName);
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const response = await this.request<OpenRouterModelsResponse>('/v1/models');

    return response.data.map(m => ({
      id: m.id,
      name: m.name,
      provider: 'openrouter',
      contextWindow: m.context_length ?? m.top_provider?.context_length,
      maxOutputTokens: m.top_provider?.max_completion_tokens,
      inputPricePerMillion: parsePerTokenPrice(m.pricing?.prompt),
      outputPricePerMillion: parsePerTokenPrice(m.pricing?.completion),
      capabilities: this.getModelCapabilities(m.id),
    }));
  }

  protected getModelCapabilities(id: string): Partial<ProviderCapabilities> {
    const hasVision = id.includes('vision') ||
                      id.includes('claude-3') ||
                      id.includes('gpt-4o') ||
                      id.includes('gemini');

    return {
      vision: hasVision,
      functionCalling: !id.includes('instruct'),
    };
  }
}

// OpenRouter pricing is USD per token as a string (e.g. "0.000003");
// "-1" marks dynamic/BYOK pricing and maps to undefined.
function parsePerTokenPrice(price: string | undefined): number | undefined {
  const perToken = Number(price);
  if (!Number.isFinite(perToken) || perToken < 0) return undefined;
  return perToken * 1_000_000;
}

// -----------------------------------------------------------------------------
// Factory Function
// -----------------------------------------------------------------------------

export function openrouter(options?: OpenRouterProviderOptions): OpenRouterProvider {
  return new OpenRouterProvider(options);
}
