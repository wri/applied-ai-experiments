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
      contextWindow: m.context_length,
      capabilities: this.getModelCapabilities(m.id),
    }));
  }
  
  protected formatModelName(id: string): string {
    // OpenRouter model IDs are like "anthropic/claude-3-opus"
    const [provider, model] = id.split('/');
    return `${model} (${provider})`;
  }
  
  protected getContextWindow(id: string): number {
    // Common context windows by model family
    if (id.includes('claude-3')) return 200000;
    if (id.includes('gpt-4')) return 128000;
    if (id.includes('gemini')) return 1000000;
    if (id.includes('llama-3')) return 128000;
    if (id.includes('mistral')) return 32768;
    return 4096;
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

// -----------------------------------------------------------------------------
// Factory Function
// -----------------------------------------------------------------------------

export function openrouter(options?: OpenRouterProviderOptions): OpenRouterProvider {
  return new OpenRouterProvider(options);
}
