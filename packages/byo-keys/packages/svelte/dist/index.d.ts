import { Readable } from 'svelte/store';
import { BYOKClient, ProviderId, KeyStatus, LLMProvider, BYOKState, KeyMetadata, KeyValidationResult, ChatRequest, ChatResponse, ChatStreamChunk, ModelInfo } from '@byo-keys/core';

interface BYOKStores {
    /**
     * Reactive store of all key statuses by provider ID
     */
    keys: Readable<Record<ProviderId, KeyStatus>>;
    /**
     * Reactive store of available providers
     */
    providers: Readable<LLMProvider[]>;
    /**
     * Reactive store of initialization state
     */
    initialized: Readable<boolean>;
    /**
     * Reactive store of the full BYOK state
     */
    state: Readable<BYOKState>;
    /**
     * Set an API key for a provider
     */
    setKey: (providerId: ProviderId, key: string, metadata?: KeyMetadata) => Promise<KeyValidationResult>;
    /**
     * Remove an API key
     */
    removeKey: (providerId: ProviderId) => Promise<void>;
    /**
     * Check if a provider has a key
     */
    hasKey: (providerId: ProviderId) => boolean;
    /**
     * Get the underlying client
     */
    getClient: () => BYOKClient;
    /**
     * Initialize the client (loads stored keys)
     * Call this in onMount or a load function
     */
    initialize: () => Promise<void>;
    /**
     * Send a chat request
     */
    chat: (providerId: ProviderId, request: ChatRequest) => Promise<ChatResponse>;
    /**
     * Send a streaming chat request
     */
    chatStream: (providerId: ProviderId, request: ChatRequest) => AsyncIterable<ChatStreamChunk>;
    /**
     * Create a streaming chat store for reactive UI updates
     */
    createChatStream: (providerId: ProviderId, request: ChatRequest) => ChatStreamStore;
    /**
     * Reactive store of models by provider ID
     */
    models: Readable<Partial<Record<ProviderId, ModelInfo[]>>>;
    /**
     * Reactive store of selected model ID by provider
     */
    selectedModels: Readable<Partial<Record<ProviderId, string | undefined>>>;
    /**
     * Select a model for a provider
     */
    selectModel: (providerId: ProviderId, modelId: string) => void;
    /**
     * Refresh models from provider API
     */
    refreshModels: (providerId: ProviderId) => Promise<ModelInfo[]>;
}
interface ChatStreamStore {
    /** Current accumulated content */
    content: Readable<string>;
    /** Current accumulated thinking/reasoning content */
    thinking: Readable<string>;
    /** Whether the stream is active */
    streaming: Readable<boolean>;
    /** Whether currently receiving thinking content */
    isThinking: Readable<boolean>;
    /** Any error that occurred */
    error: Readable<Error | null>;
    /** Token usage (when available) */
    usage: Readable<{
        inputTokens?: number;
        outputTokens?: number;
        thinkingTokens?: number;
    } | null>;
    /** Start the stream */
    start: () => Promise<void>;
    /** Abort the stream */
    abort: () => void;
}
declare function createBYOKStores(client: BYOKClient): BYOKStores;
/**
 * Set the BYOK stores in Svelte context
 * Call this in your root +layout.svelte
 */
declare function setBYOKContext(stores: BYOKStores): void;
/**
 * Get the BYOK stores from Svelte context
 * Call this in any component that needs access
 */
declare function getBYOKContext(): BYOKStores;
/**
 * Create a derived store that indicates if a specific provider is ready to use
 */
declare function createProviderReadyStore(stores: BYOKStores, providerId: ProviderId): Readable<boolean>;
/**
 * Create a derived store that returns all ready providers
 */
declare function createReadyProvidersStore(stores: BYOKStores): Readable<LLMProvider[]>;
/**
 * Browser-only initialization for SvelteKit
 * Use in onMount to safely initialize the client
 *
 * @example
 * ```svelte
 * <script>
 *   import { onMount } from 'svelte';
 *   import { initializeBYOK, getBYOKContext } from '@byo-keys/svelte';
 *
 *   const stores = getBYOKContext();
 *
 *   onMount(() => initializeBYOK(stores));
 * </script>
 * ```
 */
declare function initializeBYOK(stores: BYOKStores): Promise<void>;

export { type BYOKStores, type ChatStreamStore, createBYOKStores, createProviderReadyStore, createReadyProvidersStore, getBYOKContext, initializeBYOK, setBYOKContext };
