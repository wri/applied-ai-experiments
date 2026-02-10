// =============================================================================
// Groq Provider
// =============================================================================
// Groq provides ultra-fast LLM inference using custom LPU hardware.
// API is OpenAI-compatible.

import { OpenAICompatProvider, type OpenAICompatProviderOptions } from './openai-compat';
import type {
  ProviderConfig,
  ProviderCapabilities,
} from '@byo-keys/core';

// -----------------------------------------------------------------------------
// Provider Options
// -----------------------------------------------------------------------------

export interface GroqProviderOptions extends OpenAICompatProviderOptions {}

// -----------------------------------------------------------------------------
// Known Groq Models (as of 2024)
// -----------------------------------------------------------------------------

const GROQ_MODELS = {
  // Llama 3.3
  'llama-3.3-70b-versatile': { name: 'Llama 3.3 70B Versatile', context: 128000, vision: false },
  
  // Llama 3.2
  'llama-3.2-90b-vision-preview': { name: 'Llama 3.2 90B Vision', context: 128000, vision: true },
  'llama-3.2-11b-vision-preview': { name: 'Llama 3.2 11B Vision', context: 128000, vision: true },
  'llama-3.2-3b-preview': { name: 'Llama 3.2 3B', context: 128000, vision: false },
  'llama-3.2-1b-preview': { name: 'Llama 3.2 1B', context: 128000, vision: false },
  
  // Llama 3.1
  'llama-3.1-70b-versatile': { name: 'Llama 3.1 70B Versatile', context: 128000, vision: false },
  'llama-3.1-8b-instant': { name: 'Llama 3.1 8B Instant', context: 128000, vision: false },
  
  // Mixtral
  'mixtral-8x7b-32768': { name: 'Mixtral 8x7B', context: 32768, vision: false },
  
  // Gemma
  'gemma2-9b-it': { name: 'Gemma 2 9B', context: 8192, vision: false },
  
  // Tool Use
  'llama3-groq-70b-8192-tool-use-preview': { name: 'Llama 3 70B Tool Use', context: 8192, vision: false },
  'llama3-groq-8b-8192-tool-use-preview': { name: 'Llama 3 8B Tool Use', context: 8192, vision: false },
  
  // Whisper (speech)
  'whisper-large-v3': { name: 'Whisper Large v3', context: 0, vision: false },
  'whisper-large-v3-turbo': { name: 'Whisper Large v3 Turbo', context: 0, vision: false },
} as const;

// -----------------------------------------------------------------------------
// Groq Provider Implementation
// -----------------------------------------------------------------------------

export class GroqProvider extends OpenAICompatProvider {
  readonly config: ProviderConfig = {
    id: 'groq',
    name: 'Groq',
    requiresKey: true,
    supportsCORS: false, // Groq requires proxy for browser use
    baseUrl: 'https://api.groq.com/openai',
  };
  
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    streaming: true,
    embeddings: false,
    images: false,
    audio: true, // Whisper models
    vision: true, // Some models support vision
    functionCalling: true,
    extendedThinking: false,
  };
  
  constructor(options: GroqProviderOptions = {}) {
    super({
      defaultMaxTokens: 8192,
      ...options,
    });
  }
  
  protected formatModelName(id: string): string {
    const known = GROQ_MODELS[id as keyof typeof GROQ_MODELS];
    return known?.name ?? id;
  }
  
  protected getContextWindow(id: string): number {
    const known = GROQ_MODELS[id as keyof typeof GROQ_MODELS];
    if (known) return known.context;
    
    // Fallback based on patterns
    if (id.includes('32768')) return 32768;
    if (id.includes('8192')) return 8192;
    return 8192;
  }
  
  protected getModelCapabilities(id: string): Partial<ProviderCapabilities> {
    const known = GROQ_MODELS[id as keyof typeof GROQ_MODELS];
    
    return {
      vision: known?.vision ?? id.includes('vision'),
      functionCalling: id.includes('tool-use') || (!id.includes('whisper') && !id.includes('vision')),
      audio: id.includes('whisper'),
    };
  }
}

// -----------------------------------------------------------------------------
// Factory Function
// -----------------------------------------------------------------------------

export function groq(options?: GroqProviderOptions): GroqProvider {
  return new GroqProvider(options);
}
