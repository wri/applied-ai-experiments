// =============================================================================
// Together AI Provider
// =============================================================================
// Together AI provides access to many open-source models with competitive pricing.
// API is OpenAI-compatible.

import { OpenAICompatProvider, type OpenAICompatProviderOptions } from './openai-compat';
import type {
  ProviderConfig,
  ProviderCapabilities,
} from '@byo-keys/core';

// -----------------------------------------------------------------------------
// Provider Options
// -----------------------------------------------------------------------------

export interface TogetherProviderOptions extends OpenAICompatProviderOptions {}

// -----------------------------------------------------------------------------
// Together Provider Implementation
// -----------------------------------------------------------------------------

export class TogetherProvider extends OpenAICompatProvider {
  readonly config: ProviderConfig = {
    id: 'together',
    name: 'Together AI',
    requiresKey: true,
    supportsCORS: false, // Together requires proxy for browser use
    baseUrl: 'https://api.together.xyz',
  };
  
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    streaming: true,
    embeddings: true,
    images: true, // Image generation models
    audio: false,
    vision: true, // Some models support vision
    functionCalling: true,
    extendedThinking: false,
  };
  
  constructor(options: TogetherProviderOptions = {}) {
    super({
      defaultMaxTokens: 4096,
      ...options,
    });
  }
  
  protected formatModelName(id: string): string {
    // Together model IDs are like "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo"
    const parts = id.split('/');
    const modelName = parts[1] ?? parts[0] ?? id;
    return modelName.replace(/-/g, ' ');
  }
  
  protected getContextWindow(id: string): number {
    const lowerModel = id.toLowerCase();
    
    // Llama 3.x models
    if (lowerModel.includes('llama-3')) return 128000;
    
    // Mixtral models
    if (lowerModel.includes('mixtral-8x22b')) return 65536;
    if (lowerModel.includes('mixtral')) return 32768;
    
    // Qwen models
    if (lowerModel.includes('qwen')) return 32768;
    
    // DeepSeek
    if (lowerModel.includes('deepseek')) return 64000;
    
    // Gemma
    if (lowerModel.includes('gemma')) return 8192;
    
    return 4096;
  }
  
  protected getModelCapabilities(id: string): Partial<ProviderCapabilities> {
    const lowerModel = id.toLowerCase();
    
    const hasVision = lowerModel.includes('vision') ||
                      lowerModel.includes('llava');
    
    const hasImageGen = lowerModel.includes('flux') ||
                        lowerModel.includes('stable-diffusion');
    
    return {
      vision: hasVision,
      images: hasImageGen,
      functionCalling: !hasImageGen && !lowerModel.includes('instruct'),
    };
  }
}

// -----------------------------------------------------------------------------
// Factory Function
// -----------------------------------------------------------------------------

export function together(options?: TogetherProviderOptions): TogetherProvider {
  return new TogetherProvider(options);
}
