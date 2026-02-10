// =============================================================================
// @byo-keys/providers - Provider Implementations
// =============================================================================

// Re-export base provider utilities from core
export { BaseProvider, parseSSE, type BaseProviderOptions } from '@byo-keys/core';

// OpenAI-compatible base (for custom providers)
export { 
  OpenAICompatProvider, 
  type OpenAICompatProviderOptions 
} from './openai-compat';

// -----------------------------------------------------------------------------
// Cloud Providers (require API keys)
// -----------------------------------------------------------------------------

// Anthropic
export { 
  AnthropicProvider, 
  anthropic, 
  type AnthropicProviderOptions 
} from './anthropic';

// OpenAI
export { 
  OpenAIProvider, 
  openai, 
  type OpenAIProviderOptions 
} from './openai';

// Google Gemini
export { 
  GeminiProvider, 
  gemini, 
  type GeminiProviderOptions 
} from './gemini';

// Mistral AI
export { 
  MistralProvider, 
  mistral, 
  type MistralProviderOptions 
} from './mistral';

// Groq (ultra-fast inference)
export { 
  GroqProvider, 
  groq, 
  type GroqProviderOptions 
} from './groq';

// Together AI
export { 
  TogetherProvider, 
  together, 
  type TogetherProviderOptions 
} from './together';

// OpenRouter (multi-provider gateway)
export { 
  OpenRouterProvider, 
  openrouter, 
  type OpenRouterProviderOptions 
} from './openrouter';

// -----------------------------------------------------------------------------
// Local Inference
// -----------------------------------------------------------------------------

// Ollama (local models)
export { 
  OllamaProvider, 
  ollama, 
  type OllamaProviderOptions 
} from './ollama';

// -----------------------------------------------------------------------------
// Provider Metadata
// -----------------------------------------------------------------------------

/** 
 * Provider metadata for UI display and configuration 
 */
export const PROVIDER_METADATA = {
  anthropic: {
    name: 'Anthropic',
    description: 'Claude models with advanced reasoning',
    supportsCORS: false,
    requiresKey: true,
    keyPlaceholder: 'sk-ant-...',
    docsUrl: 'https://docs.anthropic.com/',
  },
  openai: {
    name: 'OpenAI',
    description: 'GPT and o-series models',
    supportsCORS: false,
    requiresKey: true,
    keyPlaceholder: 'sk-...',
    docsUrl: 'https://platform.openai.com/docs/',
  },
  gemini: {
    name: 'Google Gemini',
    description: 'Gemini models with native CORS support',
    supportsCORS: true,
    requiresKey: true,
    keyPlaceholder: 'AI...',
    docsUrl: 'https://ai.google.dev/docs',
  },
  mistral: {
    name: 'Mistral AI',
    description: 'Efficient European-built models',
    supportsCORS: false,
    requiresKey: true,
    keyPlaceholder: '...',
    docsUrl: 'https://docs.mistral.ai/',
  },
  groq: {
    name: 'Groq',
    description: 'Ultra-fast inference on LPU hardware',
    supportsCORS: false,
    requiresKey: true,
    keyPlaceholder: 'gsk_...',
    docsUrl: 'https://console.groq.com/docs/',
  },
  together: {
    name: 'Together AI',
    description: 'Open-source models at competitive prices',
    supportsCORS: false,
    requiresKey: true,
    keyPlaceholder: '...',
    docsUrl: 'https://docs.together.ai/',
  },
  openrouter: {
    name: 'OpenRouter',
    description: 'Access 100+ models with native CORS support',
    supportsCORS: true,
    requiresKey: true,
    keyPlaceholder: 'sk-or-...',
    docsUrl: 'https://openrouter.ai/docs',
  },
  ollama: {
    name: 'Ollama',
    description: 'Run models locally on your machine',
    supportsCORS: true,
    requiresKey: false,
    keyPlaceholder: '',
    docsUrl: 'https://ollama.ai/',
  },
} as const;

export type ProviderType = keyof typeof PROVIDER_METADATA;
