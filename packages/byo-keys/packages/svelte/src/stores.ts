// =============================================================================
// Svelte/SvelteKit Adapter for BYOK-LLM
// =============================================================================
// 
// Provides reactive Svelte stores that wrap the core BYOK client.
// Handles SSR gracefully by deferring initialization to the browser.
//
// Usage:
//   import { createBYOKStores } from '@byo-keys/svelte';
//   const { keys, providers, chat, initialize } = createBYOKStores(client);
// =============================================================================

import { writable, derived, readable, get } from 'svelte/store';
import type { Readable } from 'svelte/store';
import type {
  BYOKClient,
  BYOKState,
  BYOKEvent,
  ProviderId,
  KeyStatus,
  KeyValidationResult,
  KeyMetadata,
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  LLMProvider,
  ModelInfo,
} from '@byo-keys/core';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface BYOKStores {
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

export interface ChatStreamStore {
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
  usage: Readable<{ inputTokens?: number; outputTokens?: number; thinkingTokens?: number } | null>;
  /** Start the stream */
  start: () => Promise<void>;
  /** Abort the stream */
  abort: () => void;
}

// -----------------------------------------------------------------------------
// Store Factory
// -----------------------------------------------------------------------------

export function createBYOKStores(client: BYOKClient): BYOKStores {
  // Internal state store
  const stateStore = writable<BYOKState>(client.getState());
  
  // Subscribe to client events to keep stores in sync
  // Note: unsubscribe is intentionally unused as we want to keep listening for the lifetime of the stores
  client.subscribe((event: BYOKEvent) => {
    if (event.type === 'state:changed') {
      stateStore.set(event.state);
    }
  });
  
  // Derived stores
  const keys = derived(stateStore, $state => $state.keys);
  const initialized = derived(stateStore, $state => $state.initialized);
  const providers = readable(client.listProviders(), () => {});

  // Model stores
  const models = derived(stateStore, $state => {
    const result: Partial<Record<ProviderId, ModelInfo[]>> = {};
    for (const [id, status] of Object.entries($state.keys)) {
      result[id as ProviderId] = (status as { models?: ModelInfo[] }).models ?? [];
    }
    return result;
  });

  const selectedModels = derived(stateStore, $state => {
    const result: Partial<Record<ProviderId, string | undefined>> = {};
    for (const [id, status] of Object.entries($state.keys)) {
      result[id as ProviderId] = (status as { selectedModel?: string }).selectedModel;
    }
    return result;
  });
  
  // Key management functions
  async function setKey(
    providerId: ProviderId, 
    key: string, 
    metadata?: KeyMetadata
  ): Promise<KeyValidationResult> {
    return client.setKey(providerId, key, metadata);
  }
  
  async function removeKey(providerId: ProviderId): Promise<void> {
    return client.removeKey(providerId);
  }
  
  function hasKey(providerId: ProviderId): boolean {
    return get(keys)[providerId]?.hasKey ?? false;
  }
  
  // Chat functions
  async function chat(providerId: ProviderId, request: ChatRequest): Promise<ChatResponse> {
    return client.chat(providerId, request);
  }
  
  function chatStream(providerId: ProviderId, request: ChatRequest): AsyncIterable<ChatStreamChunk> {
    return client.chatStream(providerId, request);
  }

  // Model selection functions
  function selectModel(providerId: ProviderId, modelId: string): void {
    client.selectModel(providerId, modelId);
  }

  async function refreshModels(providerId: ProviderId): Promise<ModelInfo[]> {
    return client.refreshModels(providerId);
  }
  
  // Streaming chat store factory
  function createChatStream(providerId: ProviderId, request: ChatRequest): ChatStreamStore {
    const content = writable('');
    const thinking = writable('');
    const streaming = writable(false);
    const isThinking = writable(false);
    const error = writable<Error | null>(null);
    const usage = writable<{ inputTokens?: number; outputTokens?: number; thinkingTokens?: number } | null>(null);

    let abortController: AbortController | null = null;

    async function start(): Promise<void> {
      // Reset state
      content.set('');
      thinking.set('');
      error.set(null);
      usage.set(null);
      streaming.set(true);
      isThinking.set(false);

      abortController = new AbortController();

      try {
        for await (const chunk of client.chatStream(providerId, request)) {
          if (abortController.signal.aborted) break;

          switch (chunk.type) {
            case 'delta':
              content.update(c => c + chunk.content);
              break;
            case 'thinking_delta':
              isThinking.set(true);
              thinking.update(t => t + chunk.thinking);
              break;
            case 'thinking_complete':
              isThinking.set(false);
              break;
            case 'usage':
              usage.set({
                inputTokens: chunk.usage.inputTokens,
                outputTokens: chunk.usage.outputTokens,
                thinkingTokens: chunk.usage.thinkingTokens,
              });
              break;
            case 'error':
              error.set(new Error(chunk.error.message));
              break;
          }
        }
      } catch (e) {
        if (!abortController.signal.aborted) {
          error.set(e instanceof Error ? e : new Error(String(e)));
        }
      } finally {
        streaming.set(false);
        isThinking.set(false);
        abortController = null;
      }
    }

    function abort(): void {
      abortController?.abort();
    }

    return {
      content: { subscribe: content.subscribe },
      thinking: { subscribe: thinking.subscribe },
      streaming: { subscribe: streaming.subscribe },
      isThinking: { subscribe: isThinking.subscribe },
      error: { subscribe: error.subscribe },
      usage: { subscribe: usage.subscribe },
      start,
      abort,
    };
  }
  
  return {
    keys: { subscribe: keys.subscribe },
    providers: { subscribe: providers.subscribe },
    initialized: { subscribe: initialized.subscribe },
    state: { subscribe: stateStore.subscribe },
    models: { subscribe: models.subscribe },
    selectedModels: { subscribe: selectedModels.subscribe },
    setKey,
    removeKey,
    hasKey,
    getClient: () => client,
    initialize: () => client.initialize(),
    chat,
    chatStream,
    createChatStream,
    selectModel,
    refreshModels,
  };
}

// -----------------------------------------------------------------------------
// Context API for SvelteKit
// -----------------------------------------------------------------------------

import { getContext, setContext } from 'svelte';

const BYOK_CONTEXT_KEY = Symbol('byo-keys');

/**
 * Set the BYOK stores in Svelte context
 * Call this in your root +layout.svelte
 */
export function setBYOKContext(stores: BYOKStores): void {
  setContext(BYOK_CONTEXT_KEY, stores);
}

/**
 * Get the BYOK stores from Svelte context
 * Call this in any component that needs access
 */
export function getBYOKContext(): BYOKStores {
  const stores = getContext<BYOKStores>(BYOK_CONTEXT_KEY);
  
  if (!stores) {
    throw new Error(
      'BYOK context not found. Make sure to call setBYOKContext in a parent component.'
    );
  }
  
  return stores;
}

// -----------------------------------------------------------------------------
// Convenience Hooks for Common Patterns
// -----------------------------------------------------------------------------

/**
 * Create a derived store that indicates if a specific provider is ready to use
 */
export function createProviderReadyStore(
  stores: BYOKStores, 
  providerId: ProviderId
): Readable<boolean> {
  return derived(stores.keys, $keys => {
    const status = $keys[providerId];
    return status?.hasKey === true && status?.isValid === true;
  });
}

/**
 * Create a derived store that returns all ready providers
 */
export function createReadyProvidersStore(stores: BYOKStores): Readable<LLMProvider[]> {
  return derived([stores.keys, stores.providers], ([$keys, $providers]) => {
    return $providers.filter(p => {
      const status = $keys[p.config.id];
      // Provider is ready if it doesn't require a key OR has a valid key
      return !p.config.requiresKey || (status?.hasKey && status?.isValid);
    });
  });
}

// -----------------------------------------------------------------------------
// SSR-Safe Initialization Helper
// -----------------------------------------------------------------------------

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
export async function initializeBYOK(stores: BYOKStores): Promise<void> {
  if (typeof window === 'undefined') {
    console.warn('initializeBYOK called on server, skipping');
    return;
  }
  
  await stores.initialize();
}
