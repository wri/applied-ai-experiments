// =============================================================================
// Mistral AI Provider
// =============================================================================
// Mistral AI provides efficient, powerful models with an OpenAI-compatible API.

import { OpenAICompatProvider, type OpenAICompatProviderOptions } from './openai-compat';
import type {
  ProviderConfig,
  ProviderCapabilities,
} from '@byo-keys/core';

// -----------------------------------------------------------------------------
// Provider Options
// -----------------------------------------------------------------------------

export interface MistralProviderOptions extends OpenAICompatProviderOptions {}

// -----------------------------------------------------------------------------
// Known Mistral Models
// -----------------------------------------------------------------------------

const MISTRAL_MODELS = {
  // Latest models
  'mistral-large-latest': { name: 'Mistral Large', context: 128000 },
  'mistral-medium-latest': { name: 'Mistral Medium', context: 32768 },
  'mistral-small-latest': { name: 'Mistral Small', context: 32768 },
  
  // Specific versions
  'mistral-large-2411': { name: 'Mistral Large (Nov 2024)', context: 128000 },
  'mistral-large-2407': { name: 'Mistral Large (Jul 2024)', context: 128000 },
  
  // Open models
  'open-mistral-nemo': { name: 'Mistral Nemo (12B)', context: 128000 },
  'open-mixtral-8x22b': { name: 'Mixtral 8x22B', context: 65536 },
  'open-mixtral-8x7b': { name: 'Mixtral 8x7B', context: 32768 },
  'open-mistral-7b': { name: 'Mistral 7B', context: 32768 },
  
  // Specialized
  'codestral-latest': { name: 'Codestral', context: 32768 },
  'codestral-mamba-latest': { name: 'Codestral Mamba', context: 256000 },
  'pixtral-large-latest': { name: 'Pixtral Large (Vision)', context: 128000 },
  'pixtral-12b-2409': { name: 'Pixtral 12B (Vision)', context: 128000 },
  
  // Embedding
  'mistral-embed': { name: 'Mistral Embed', context: 8192 },
} as const;

// -----------------------------------------------------------------------------
// Mistral Provider Implementation
// -----------------------------------------------------------------------------

export class MistralProvider extends OpenAICompatProvider {
  readonly config: ProviderConfig = {
    id: 'mistral',
    name: 'Mistral AI',
    requiresKey: true,
    supportsCORS: false, // Mistral requires proxy for browser use
    baseUrl: 'https://api.mistral.ai',
  };
  
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    streaming: true,
    embeddings: true,
    images: false,
    audio: false,
    vision: true, // Pixtral models
    functionCalling: true,
    extendedThinking: false,
  };
  
  constructor(options: MistralProviderOptions = {}) {
    super({
      defaultMaxTokens: 4096,
      ...options,
    });
  }
  
  protected formatModelName(id: string): string {
    const known = MISTRAL_MODELS[id as keyof typeof MISTRAL_MODELS];
    return known?.name ?? id;
  }
  
  protected getContextWindow(id: string): number {
    const known = MISTRAL_MODELS[id as keyof typeof MISTRAL_MODELS];
    if (known) return known.context;
    
    // Fallback based on patterns
    if (id.includes('large')) return 128000;
    if (id.includes('8x22b')) return 65536;
    return 32768;
  }
  
  protected getModelCapabilities(id: string): Partial<ProviderCapabilities> {
    const isVision = id.includes('pixtral');
    const isEmbedding = id.includes('embed');
    const isCode = id.includes('codestral');
    
    return {
      vision: isVision,
      embeddings: isEmbedding,
      functionCalling: !isEmbedding && !isCode,
    };
  }
}

// -----------------------------------------------------------------------------
// Factory Function
// -----------------------------------------------------------------------------

export function mistral(options?: MistralProviderOptions): MistralProvider {
  return new MistralProvider(options);
}
