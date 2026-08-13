// =============================================================================
// Hugging Face Provider
// =============================================================================
// Hugging Face Inference Providers exposes an OpenAI-compatible router that
// serves open models across multiple inference partners. It supports CORS for
// browser-based requests, making it ideal for BYOK apps.
//
// Model ids are "org/model" and accept an optional routing suffix:
//   - ":<provider>" (e.g. "meta-llama/Llama-3.3-70B-Instruct:cerebras")
//   - ":fastest" (router default), ":cheapest", ":preferred"
// Suffixed ids pass through ChatRequest.model untouched.

import { OpenAICompatProvider, type OpenAICompatProviderOptions } from './openai-compat';
import type {
  ProviderConfig,
  ProviderCapabilities,
  ModelInfo,
  KeyValidationResult,
} from '@byo-keys/core';

// -----------------------------------------------------------------------------
// Hugging Face Router Types
// -----------------------------------------------------------------------------

interface HFRouterModelsResponse {
  data: Array<{
    id: string;
    object: 'model';
    created?: number;
    owned_by?: string;
    architecture?: {
      input_modalities?: string[];
      output_modalities?: string[];
    };
    providers?: Array<{
      provider: string;
      status: string;
      context_length?: number;
      /** USD per million tokens */
      pricing?: { input: number; output: number };
      supports_tools?: boolean;
      supports_structured_output?: boolean;
    }>;
  }>;
}

// -----------------------------------------------------------------------------
// Provider Options
// -----------------------------------------------------------------------------

export interface HuggingFaceProviderOptions extends OpenAICompatProviderOptions {}

// -----------------------------------------------------------------------------
// Hugging Face Provider Implementation
// -----------------------------------------------------------------------------

const WHOAMI_URL = 'https://huggingface.co/api/whoami-v2';

export class HuggingFaceProvider extends OpenAICompatProvider {
  readonly config: ProviderConfig = {
    id: 'huggingface',
    name: 'Hugging Face',
    requiresKey: true,
    supportsCORS: true, // The router supports browser requests
    baseUrl: 'https://router.huggingface.co',
    apiKeyUrl: 'https://huggingface.co/settings/tokens',
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

  // The router's /v1/models endpoint is unauthenticated, so the inherited
  // listModels-based validation would accept any key. Validate the token
  // against the whoami endpoint (CORS-enabled) instead.
  async validateKey(key: string): Promise<KeyValidationResult> {
    try {
      const response = await this.fetchFn(WHOAMI_URL, {
        headers: { Authorization: `Bearer ${key}` },
      });

      if (!response.ok) {
        return {
          valid: false,
          providerId: this.config.id,
          error: `HTTP ${response.status}: invalid Hugging Face token`,
          errorCode: response.status === 401 ? 'invalid_key' : 'provider_error',
        };
      }

      const originalKey = this.apiKey;
      this.apiKey = key;
      try {
        const models = await this.listModels();
        return {
          valid: true,
          providerId: this.config.id,
          models,
        };
      } finally {
        this.apiKey = originalKey;
      }
    } catch (error) {
      return {
        valid: false,
        providerId: this.config.id,
        error: error instanceof Error ? error.message : 'Network error',
        errorCode: 'network_error',
      };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const response = await this.request<HFRouterModelsResponse>('/v1/models');

    return response.data.map(m => {
      const live = (m.providers ?? []).filter(p => p.status === 'live');
      const contexts = live
        .map(p => p.context_length)
        .filter((n): n is number => typeof n === 'number');
      const priced = live.filter(p => p.pricing);
      // Cheapest pricing across providers (matches the router's :cheapest
      // policy; the default :fastest route may cost more)
      const cheapest = priced.length
        ? priced.reduce((a, b) => (a.pricing!.output <= b.pricing!.output ? a : b))
        : undefined;

      return {
        id: m.id,
        name: m.id,
        provider: this.config.id,
        contextWindow: contexts.length ? Math.max(...contexts) : undefined,
        inputPricePerMillion: cheapest?.pricing?.input,
        outputPricePerMillion: cheapest?.pricing?.output,
        capabilities: {
          vision: m.architecture?.input_modalities?.includes('image') ?? false,
          functionCalling: live.some(p => p.supports_tools),
        },
      };
    });
  }
}

// -----------------------------------------------------------------------------
// Factory Function
// -----------------------------------------------------------------------------

export function huggingface(options?: HuggingFaceProviderOptions): HuggingFaceProvider {
  return new HuggingFaceProvider(options);
}
