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
  /** Available models for this provider */
  models: ModelConfig[];
  /** Default model ID to select */
  defaultModel?: string;
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
