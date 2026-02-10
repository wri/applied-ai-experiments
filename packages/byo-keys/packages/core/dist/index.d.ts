type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'openrouter' | 'groq' | 'together' | (string & {});
interface ProviderConfig {
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
interface ProviderCapabilities {
    chat: boolean;
    streaming: boolean;
    embeddings: boolean;
    images: boolean;
    audio: boolean;
    vision: boolean;
    functionCalling: boolean;
    extendedThinking: boolean;
}
interface ModelInfo {
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
interface ModelFilter {
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
interface ProviderModelConfig {
    filter?: ModelFilter;
    defaultModel?: string;
}
type MessageRole = 'user' | 'assistant' | 'system';
interface TextContent {
    type: 'text';
    text: string;
}
interface ImageContent {
    type: 'image';
    source: {
        type: 'base64';
        mediaType: string;
        data: string;
    } | {
        type: 'url';
        url: string;
    };
}
interface ThinkingContent {
    type: 'thinking';
    thinking: string;
}
type ContentPart = TextContent | ImageContent | ThinkingContent;
interface Message {
    role: MessageRole;
    content: string | ContentPart[];
}
interface ChatRequest {
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
    tools?: ToolDefinition[];
    toolChoice?: ToolChoice;
    providerOptions?: Record<string, unknown>;
}
interface ChatResponse {
    id: string;
    model: string;
    content: string;
    finishReason: FinishReason;
    usage: TokenUsage;
    /** Thinking/reasoning content (full thinking for Anthropic, summary for OpenAI/Gemini) */
    thinking?: string;
    raw?: unknown;
}
type FinishReason = 'stop' | 'length' | 'tool_use' | 'content_filter' | 'error' | 'unknown';
interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    thinkingTokens?: number;
}
type ChatStreamChunk = {
    type: 'start';
    id: string;
    model: string;
} | {
    type: 'delta';
    content: string;
} | {
    type: 'thinking_delta';
    thinking: string;
} | {
    type: 'thinking_complete';
} | {
    type: 'usage';
    usage: Partial<TokenUsage>;
} | {
    type: 'done';
    finishReason: FinishReason;
} | {
    type: 'error';
    error: BYOKError;
};
interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}
type ToolChoice = 'auto' | 'none' | {
    type: 'tool';
    name: string;
};
interface StoredKey {
    providerId: ProviderId;
    key: string;
    addedAt: number;
    validatedAt?: number;
    isValid?: boolean;
    metadata?: KeyMetadata;
}
interface KeyMetadata {
    label?: string;
    scopes?: string[];
    expiresAt?: number;
    models?: string[];
}
interface KeyValidationResult {
    valid: boolean;
    providerId: ProviderId;
    error?: string;
    errorCode?: KeyValidationErrorCode;
    models?: ModelInfo[];
    rateLimit?: RateLimitInfo;
}
type KeyValidationErrorCode = 'invalid_key' | 'expired_key' | 'insufficient_permissions' | 'rate_limited' | 'network_error' | 'provider_error' | 'provider_not_found' | 'validation_failed' | 'no_key' | 'unknown';
interface RateLimitInfo {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
    tokensPerDay?: number;
}
interface KeyStorage {
    get(providerId: ProviderId): Promise<StoredKey | null>;
    set(providerId: ProviderId, key: string, metadata?: KeyMetadata): Promise<void>;
    remove(providerId: ProviderId): Promise<void>;
    list(): Promise<StoredKey[]>;
    clear(): Promise<void>;
    isEncrypted?(): boolean;
    setEncryptionKey?(passphrase: string): Promise<void>;
    clearEncryptionKey?(): void;
}
interface StorageOptions {
    /** Storage key prefix */
    prefix?: string;
    /** Enable encryption (requires passphrase) */
    encrypted?: boolean;
    /** Storage backend: 'localStorage' | 'sessionStorage' | 'memory' */
    backend?: 'localStorage' | 'sessionStorage' | 'memory';
}
type BYOKEvent = {
    type: 'key:set';
    providerId: ProviderId;
    valid: boolean;
} | {
    type: 'key:removed';
    providerId: ProviderId;
} | {
    type: 'key:validating';
    providerId: ProviderId;
} | {
    type: 'key:validated';
    providerId: ProviderId;
    result: KeyValidationResult;
} | {
    type: 'provider:added';
    providerId: ProviderId;
} | {
    type: 'provider:removed';
    providerId: ProviderId;
} | {
    type: 'model:selected';
    providerId: ProviderId;
    modelId: string;
} | {
    type: 'models:refreshed';
    providerId: ProviderId;
    models: ModelInfo[];
} | {
    type: 'error';
    error: BYOKError;
} | {
    type: 'state:changed';
    state: BYOKState;
};
type BYOKEventListener = (event: BYOKEvent) => void;
type Unsubscribe = () => void;
interface BYOKState {
    /** Map of provider ID to key status */
    keys: Record<ProviderId, KeyStatus>;
    /** List of registered provider IDs */
    providers: ProviderId[];
    /** Whether the client is initialized */
    initialized: boolean;
}
interface KeyStatus {
    hasKey: boolean;
    isValid: boolean | null;
    isValidating: boolean;
    lastValidated?: number;
    lastFourChars?: string;
    error?: string;
    /** Cached models from validation */
    models?: ModelInfo[];
    /** Currently selected model ID */
    selectedModel?: string;
}
declare class BYOKError extends Error {
    readonly code: BYOKErrorCode;
    readonly providerId?: ProviderId | undefined;
    readonly cause?: Error | undefined;
    constructor(message: string, code: BYOKErrorCode, providerId?: ProviderId | undefined, cause?: Error | undefined);
}
type BYOKErrorCode = 'no_key' | 'invalid_key' | 'provider_not_found' | 'validation_failed' | 'network_error' | 'rate_limited' | 'api_error' | 'storage_error' | 'encryption_error' | 'initialization_error';
interface LLMProvider {
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
interface BYOKClientConfig {
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
interface BYOKClient {
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

declare class BYOKClientImpl implements BYOKClient {
    private providers;
    private storage;
    private emitter;
    private config;
    private state;
    constructor(config: BYOKClientConfig);
    private registerProvider;
    getProvider(providerId: ProviderId): LLMProvider | undefined;
    listProviders(): LLMProvider[];
    setKey(providerId: ProviderId, key: string, metadata?: KeyMetadata): Promise<KeyValidationResult>;
    removeKey(providerId: ProviderId): Promise<void>;
    hasKey(providerId: ProviderId): boolean;
    getKeyStatus(providerId: ProviderId): KeyStatus | undefined;
    validateKey(providerId: ProviderId): Promise<KeyValidationResult>;
    chat(providerId: ProviderId, request: ChatRequest): Promise<ChatResponse>;
    chatStream(providerId: ProviderId, request: ChatRequest): AsyncIterable<ChatStreamChunk>;
    private getInitializedProvider;
    getModels(providerId: ProviderId): ModelInfo[];
    selectModel(providerId: ProviderId, modelId: string): void;
    getSelectedModel(providerId: ProviderId): string | undefined;
    refreshModels(providerId: ProviderId): Promise<ModelInfo[]>;
    private applyModelFilters;
    private applyFilter;
    private matchesPattern;
    private getDefaultModel;
    getState(): BYOKState;
    subscribe(listener: BYOKEventListener): Unsubscribe;
    private updateKeyStatus;
    private emit;
    initialize(): Promise<void>;
    destroy(): Promise<void>;
}
declare function createBYOKClient(config: BYOKClientConfig): BYOKClient;

declare class MemoryStorage implements KeyStorage {
    private store;
    get(providerId: ProviderId): Promise<StoredKey | null>;
    set(providerId: ProviderId, key: string, metadata?: KeyMetadata): Promise<void>;
    remove(providerId: ProviderId): Promise<void>;
    list(): Promise<StoredKey[]>;
    clear(): Promise<void>;
}
declare class LocalStorage implements KeyStorage {
    private prefix;
    private backend;
    constructor(options?: StorageOptions);
    private getStorageKey;
    get(providerId: ProviderId): Promise<StoredKey | null>;
    set(providerId: ProviderId, key: string, metadata?: KeyMetadata): Promise<void>;
    remove(providerId: ProviderId): Promise<void>;
    list(): Promise<StoredKey[]>;
    clear(): Promise<void>;
}
declare class EncryptedStorage implements KeyStorage {
    private prefix;
    private backend;
    private cryptoKey;
    private salt;
    constructor(options?: StorageOptions);
    /**
     * Derive an encryption key from a passphrase
     */
    setEncryptionKey(passphrase: string): Promise<void>;
    clearEncryptionKey(): void;
    isEncrypted(): boolean;
    private assertEncrypted;
    private encrypt;
    private decrypt;
    private getStorageKey;
    get(providerId: ProviderId): Promise<StoredKey | null>;
    set(providerId: ProviderId, key: string, metadata?: KeyMetadata): Promise<void>;
    remove(providerId: ProviderId): Promise<void>;
    list(): Promise<StoredKey[]>;
    clear(): Promise<void>;
}
declare function createStorage(options?: KeyStorage | StorageOptions): KeyStorage;

declare class EventEmitter {
    private listeners;
    subscribe(listener: BYOKEventListener): Unsubscribe;
    emit(event: BYOKEvent): void;
    clear(): void;
}

interface BaseProviderOptions {
    /** Override the default base URL */
    baseUrl?: string;
    /** Proxy URL for CORS-restricted providers */
    proxyUrl?: string;
    /** Custom fetch implementation */
    fetch?: typeof fetch;
    /** Default request timeout in ms */
    timeout?: number;
    /** Custom headers to include in all requests */
    headers?: Record<string, string>;
}
declare abstract class BaseProvider implements LLMProvider {
    abstract readonly config: ProviderConfig;
    abstract readonly capabilities: ProviderCapabilities;
    protected apiKey: string | null;
    protected options: BaseProviderOptions;
    protected fetchFn: typeof fetch;
    constructor(options?: BaseProviderOptions);
    initialize(key: string): void;
    isInitialized(): boolean;
    protected getApiKey(): string;
    protected getBaseUrl(): string;
    protected request<T>(endpoint: string, options?: RequestInit): Promise<T>;
    protected requestStream(endpoint: string, options?: RequestInit): AsyncIterable<string>;
    /**
     * Add authorization headers - override in subclasses for different auth schemes
     */
    protected addAuthHeaders(headers: Headers): void;
    /**
     * Parse error response - override in subclasses for provider-specific errors
     */
    protected parseError(response: Response): Promise<Error>;
    abstract validateKey(key: string): Promise<KeyValidationResult>;
    abstract listModels(): Promise<ModelInfo[]>;
    abstract chat(request: ChatRequest): Promise<ChatResponse>;
    abstract chatStream(request: ChatRequest): AsyncIterable<ChatStreamChunk>;
}
/**
 * Parse Server-Sent Events stream
 */
declare function parseSSE(stream: AsyncIterable<string>): AsyncIterable<{
    event?: string;
    data: string;
}>;

export { type BYOKClient, type BYOKClientConfig, BYOKClientImpl, BYOKError, type BYOKErrorCode, type BYOKEvent, type BYOKEventListener, type BYOKState, BaseProvider, type BaseProviderOptions, type ChatRequest, type ChatResponse, type ChatStreamChunk, type ContentPart, EncryptedStorage, EventEmitter, type FinishReason, type ImageContent, type KeyMetadata, type KeyStatus, type KeyStorage, type KeyValidationErrorCode, type KeyValidationResult, type LLMProvider, LocalStorage, MemoryStorage, type Message, type MessageRole, type ModelFilter, type ModelInfo, type ProviderCapabilities, type ProviderConfig, type ProviderId, type ProviderModelConfig, type RateLimitInfo, type StorageOptions, type StoredKey, type TextContent, type TokenUsage, type ToolChoice, type ToolDefinition, type Unsubscribe, createBYOKClient, createStorage, parseSSE };
