import type { ProviderId, ProviderCapabilities } from '@byo-keys/core';

/**
 * Model definition for static configuration
 */
export interface ModelConfig {
  /** Model ID (e.g., "claude-sonnet-4-20250514") */
  id: string;
  /** Display name (e.g., "Claude Sonnet 4") */
  name: string;
  /** Context window size in tokens */
  contextWindow?: number;
  /** Max output tokens */
  maxOutputTokens?: number;
  /** Input price per million tokens in USD */
  inputPricePerMillion?: number;
  /** Output price per million tokens in USD */
  outputPricePerMillion?: number;
  /** Model capabilities */
  capabilities?: Partial<ProviderCapabilities>;
  /** Whether the model is deprecated */
  deprecated?: boolean;
}

/**
 * Provider configuration for static model selection
 */
export interface ProviderConfig {
  /** Display name for the provider */
  name: string;
  /** Curated models for this provider */
  models: ModelConfig[];
  /** Default model ID to select */
  defaultModel?: string;
  /**
   * When true, the selector also lists models discovered live from the
   * provider's API (BYOK `listModels()`), merged after the curated `models`
   * and de-duplicated by id. Use for open catalogs (OpenRouter, Hugging Face)
   * where you want a curated default plus full live discovery. `models` may be
   * empty for a "live only" provider. Default: false (curated only).
   */
  allowDynamic?: boolean;
  /**
   * Message shown in the selector when this provider has no available models
   * (e.g. a local provider like Ollama that couldn't be reached). Replaces the
   * generic "No models available" empty state.
   */
  emptyNote?: string;
}

/**
 * Static configuration for ModelSelector
 *
 * Apps can define available models in a JSON file and pass it to ModelSelector.
 * Only providers with valid API keys will be shown.
 *
 * @example
 * ```json
 * {
 *   "providers": {
 *     "anthropic": {
 *       "name": "Anthropic",
 *       "defaultModel": "claude-sonnet-4-20250514",
 *       "models": [
 *         {
 *           "id": "claude-sonnet-4-20250514",
 *           "name": "Claude Sonnet 4",
 *           "contextWindow": 200000,
 *           "inputPricePerMillion": 3,
 *           "outputPricePerMillion": 15,
 *           "capabilities": { "vision": true, "functionCalling": true }
 *         }
 *       ]
 *     }
 *   }
 * }
 * ```
 */
export interface ModelSelectorConfig {
  /** Provider configurations keyed by provider ID */
  providers: Partial<Record<ProviderId, ProviderConfig>>;
}
