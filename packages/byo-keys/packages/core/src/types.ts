// =============================================================================
// Core Types for BYOK-LLM
// =============================================================================

// -----------------------------------------------------------------------------
// Provider Types
// -----------------------------------------------------------------------------

export type ProviderId = 
  | 'anthropic' 
  | 'openai' 
  | 'gemini' 
  | 'ollama' 
  | 'openrouter'
  | 'groq'
  | 'together'
  | (string & {}); // Allow custom providers while preserving autocomplete

export interface ProviderConfig {
  /** Provider identifier */
  id: ProviderId;
  /** Human-readable name */
  name: string;
  /** Description of the provider */
  description?: string;
  /** Whether this provider requires an API key */
  requiresKey: boolean;
  /** Whether the provider supports CORS (direct browser calls) */
  supportsCORS: boolean;
  /** Base URL for API calls */
  baseUrl: string;
  /** Optional proxy URL for CORS-restricted providers */
  proxyUrl?: string;
  /** URL to get an API key */
  apiKeyUrl?: string;
  /** Available models for this provider */
  models?: ModelInfo[];
  /** Provider-specific configuration */
  options?: Record<string, unknown>;
}

export interface ProviderCapabilities {
  chat: boolean;
  streaming: boolean;
  embeddings: boolean;
  images: boolean;
  audio: boolean;
  vision: boolean;
  functionCalling: boolean;
  extendedThinking: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: ProviderId;
  contextWindow?: number;
  maxOutputTokens?: number;
  inputPricePerMillion?: number;
  outputPricePerMillion?: number;
  capabilities?: Partial<ProviderCapabilities>;
  deprecated?: boolean;
}

/** Filter configuration for available models */
export interface ModelFilter {
  /** Include only models matching these IDs (supports * wildcards) */
  include?: string[];
  /** Exclude models matching these IDs */
  exclude?: string[];
  /** Only include models with these capabilities */
  requiredCapabilities?: (keyof ProviderCapabilities)[];
  /** Custom filter function */
  filter?: (model: ModelInfo) => boolean;
}

/** Per-provider model configuration */
export interface ProviderModelConfig {
  filter?: ModelFilter;
  defaultModel?: string;
}

// -----------------------------------------------------------------------------
// Message Types (Provider-Agnostic)
// -----------------------------------------------------------------------------

export type MessageRole = 'user' | 'assistant' | 'system';

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  source:
    | { type: 'base64'; mediaType: string; data: string }
    | { type: 'url'; url: string };
}

export interface ThinkingContent {
  type: 'thinking';
  thinking: string;
}

export type ContentPart = TextContent | ImageContent | ThinkingContent;

export interface Message {
  role: MessageRole;
  content: string | ContentPart[];
}

// -----------------------------------------------------------------------------
// Chat Request/Response Types
// -----------------------------------------------------------------------------

export interface ChatRequest {
  model: string;
  messages: Message[];
  system?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  stream?: boolean;

  /** Thinking/reasoning configuration (provider-specific behavior) */
  thinking?: {
    /** Enable thinking/reasoning mode */
    enabled: boolean;
    /** Token budget for thinking (Anthropic/Gemini) */
    budgetTokens?: number;
    /** Reasoning effort level (OpenAI: 'low' | 'medium' | 'high') */
    effort?: 'low' | 'medium' | 'high';
    /** Summary detail level (OpenAI: 'auto' | 'concise' | 'detailed') */
    summaryLevel?: 'auto' | 'concise' | 'detailed';
  };

  // Tool use (future)
  tools?: ToolDefinition[];
  toolChoice?: ToolChoice;

  // Provider-specific passthrough
  providerOptions?: Record<string, unknown>;
}

export interface ChatResponse {
  id: string;
  model: string;
  content: string;
  finishReason: FinishReason;
  usage: TokenUsage;

  /** Thinking/reasoning content (full thinking for Anthropic, summary for OpenAI/Gemini) */
  thinking?: string;

  // Raw response for debugging/advanced use
  raw?: unknown;
}

export type FinishReason = 
  | 'stop' 
  | 'length' 
  | 'tool_use' 
  | 'content_filter' 
  | 'error'
  | 'unknown';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;

  // Optional detailed breakdown
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  thinkingTokens?: number;
}

// -----------------------------------------------------------------------------
// Streaming Types
// -----------------------------------------------------------------------------

export type ChatStreamChunk =
  | { type: 'start'; id: string; model: string }
  | { type: 'delta'; content: string }
  | { type: 'thinking_delta'; thinking: string }
  | { type: 'thinking_complete' }
  | { type: 'usage'; usage: Partial<TokenUsage> }
  | { type: 'done'; finishReason: FinishReason }
  | { type: 'error'; error: BYOKError };

// -----------------------------------------------------------------------------
// Tool Types (Future)
// -----------------------------------------------------------------------------

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type ToolChoice = 
  | 'auto' 
  | 'none' 
  | { type: 'tool'; name: string };

// -----------------------------------------------------------------------------
// Key Storage Types
// -----------------------------------------------------------------------------

export interface StoredKey {
  providerId: ProviderId;
  key: string;
  addedAt: number;
  validatedAt?: number;
  isValid?: boolean;
  metadata?: KeyMetadata;
}

export interface KeyMetadata {
  label?: string;
  scopes?: string[];
  expiresAt?: number;
  models?: string[];
}

export interface KeyValidationResult {
  valid: boolean;
  providerId: ProviderId;
  error?: string;
  errorCode?: KeyValidationErrorCode;
  models?: ModelInfo[];
  rateLimit?: RateLimitInfo;
}

export type KeyValidationErrorCode =
  | 'invalid_key'
  | 'expired_key'
  | 'insufficient_permissions'
  | 'rate_limited'
  | 'network_error'
  | 'provider_error'
  | 'provider_not_found'
  | 'validation_failed'
  | 'no_key'
  | 'unknown';

export interface RateLimitInfo {
  requestsPerMinute?: number;
  tokensPerMinute?: number;
  tokensPerDay?: number;
}

// -----------------------------------------------------------------------------
// Storage Interface
// -----------------------------------------------------------------------------

export interface KeyStorage {
  get(providerId: ProviderId): Promise<StoredKey | null>;
  set(providerId: ProviderId, key: string, metadata?: KeyMetadata): Promise<void>;
  remove(providerId: ProviderId): Promise<void>;
  list(): Promise<StoredKey[]>;
  clear(): Promise<void>;
  
  // Optional encryption support
  isEncrypted?(): boolean;
  setEncryptionKey?(passphrase: string): Promise<void>;
  clearEncryptionKey?(): void;
}

export interface StorageOptions {
  /** Storage key prefix */
  prefix?: string;
  /** Enable encryption (requires passphrase) */
  encrypted?: boolean;
  /** Storage backend: 'localStorage' | 'sessionStorage' | 'memory' */
  backend?: 'localStorage' | 'sessionStorage' | 'memory';
}

// -----------------------------------------------------------------------------
// Event Types
// -----------------------------------------------------------------------------

export type BYOKEvent =
  | { type: 'key:set'; providerId: ProviderId; valid: boolean }
  | { type: 'key:removed'; providerId: ProviderId }
  | { type: 'key:validating'; providerId: ProviderId }
  | { type: 'key:validated'; providerId: ProviderId; result: KeyValidationResult }
  | { type: 'provider:added'; providerId: ProviderId }
  | { type: 'provider:removed'; providerId: ProviderId }
  | { type: 'model:selected'; providerId: ProviderId; modelId: string }
  | { type: 'models:refreshed'; providerId: ProviderId; models: ModelInfo[] }
  | { type: 'error'; error: BYOKError }
  | { type: 'state:changed'; state: BYOKState };

export type BYOKEventListener = (event: BYOKEvent) => void;
export type Unsubscribe = () => void;

// -----------------------------------------------------------------------------
// Client State
// -----------------------------------------------------------------------------

export interface BYOKState {
  /** Map of provider ID to key status */
  keys: Record<ProviderId, KeyStatus>;
  /** List of registered provider IDs */
  providers: ProviderId[];
  /** Whether the client is initialized */
  initialized: boolean;
}

export interface KeyStatus {
  hasKey: boolean;
  isValid: boolean | null; // null = not yet validated
  isValidating: boolean;
  lastValidated?: number;
  lastFourChars?: string;
  error?: string;
  /** Cached models from validation */
  models?: ModelInfo[];
  /** Currently selected model ID */
  selectedModel?: string;
}

// -----------------------------------------------------------------------------
// Error Types
// -----------------------------------------------------------------------------

export class BYOKError extends Error {
  constructor(
    message: string,
    public readonly code: BYOKErrorCode,
    public readonly providerId?: ProviderId,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'BYOKError';
  }
}

export type BYOKErrorCode =
  | 'no_key'
  | 'invalid_key'
  | 'provider_not_found'
  | 'validation_failed'
  | 'network_error'
  | 'rate_limited'
  | 'api_error'
  | 'storage_error'
  | 'encryption_error'
  | 'initialization_error';

// -----------------------------------------------------------------------------
// Provider Interface
// -----------------------------------------------------------------------------

export interface LLMProvider {
  readonly config: ProviderConfig;
  readonly capabilities: ProviderCapabilities;
  
  /**
   * Initialize the provider with an API key
   */
  initialize(key: string): void;
  
  /**
   * Check if the provider has been initialized with a key
   */
  isInitialized(): boolean;
  
  /**
   * Validate an API key without storing it
   */
  validateKey(key: string): Promise<KeyValidationResult>;
  
  /**
   * List available models
   */
  listModels(): Promise<ModelInfo[]>;
  
  /**
   * Send a chat completion request
   */
  chat(request: ChatRequest): Promise<ChatResponse>;
  
  /**
   * Send a streaming chat completion request
   */
  chatStream(request: ChatRequest): AsyncIterable<ChatStreamChunk>;
}

// -----------------------------------------------------------------------------
// Client Configuration
// -----------------------------------------------------------------------------

export interface BYOKClientConfig {
  /** Providers to register */
  providers: LLMProvider[];

  /** Storage configuration */
  storage?: KeyStorage | StorageOptions;

  /** Automatically validate keys on initialization */
  autoValidate?: boolean;

  /** Validation cache TTL in milliseconds (default: 1 hour) */
  validationCacheTTL?: number;

  /** Global proxy URL for CORS-restricted providers */
  proxyUrl?: string;

  /** Per-provider model configuration */
  modelConfig?: Partial<Record<ProviderId, ProviderModelConfig>>;

  /** Global model filter */
  globalModelFilter?: ModelFilter;
}

// -----------------------------------------------------------------------------
// Client Interface
// -----------------------------------------------------------------------------

export interface BYOKClient {
  /**
   * Get a provider by ID
   */
  getProvider(providerId: ProviderId): LLMProvider | undefined;
  
  /**
   * List all registered providers
   */
  listProviders(): LLMProvider[];
  
  /**
   * Set an API key for a provider (validates and stores)
   */
  setKey(providerId: ProviderId, key: string, metadata?: KeyMetadata): Promise<KeyValidationResult>;
  
  /**
   * Remove an API key
   */
  removeKey(providerId: ProviderId): Promise<void>;
  
  /**
   * Check if a provider has a stored key
   */
  hasKey(providerId: ProviderId): boolean;
  
  /**
   * Get the current key status for a provider
   */
  getKeyStatus(providerId: ProviderId): KeyStatus | undefined;
  
  /**
   * Re-validate a stored key
   */
  validateKey(providerId: ProviderId): Promise<KeyValidationResult>;
  
  /**
   * Send a chat request to a specific provider
   */
  chat(providerId: ProviderId, request: ChatRequest): Promise<ChatResponse>;
  
  /**
   * Send a streaming chat request
   */
  chatStream(providerId: ProviderId, request: ChatRequest): AsyncIterable<ChatStreamChunk>;
  
  /**
   * Get the current state
   */
  getState(): BYOKState;
  
  /**
   * Subscribe to state changes
   */
  subscribe(listener: BYOKEventListener): Unsubscribe;
  
  /**
   * Initialize the client (loads stored keys)
   */
  initialize(): Promise<void>;
  
  /**
   * Destroy the client and clear all state
   */
  destroy(): Promise<void>;

  /**
   * Get available models for a provider
   */
  getModels(providerId: ProviderId): ModelInfo[];

  /**
   * Set the selected model for a provider
   */
  selectModel(providerId: ProviderId, modelId: string): void;

  /**
   * Get the selected model ID for a provider
   */
  getSelectedModel(providerId: ProviderId): string | undefined;

  /**
   * Refresh models from provider API
   */
  refreshModels(providerId: ProviderId): Promise<ModelInfo[]>;
}
