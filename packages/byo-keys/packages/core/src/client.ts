// =============================================================================
// BYOK Client Implementation
// =============================================================================

import type {
  BYOKClient,
  BYOKClientConfig,
  BYOKState,
  BYOKEvent,
  BYOKEventListener,
  Unsubscribe,
  LLMProvider,
  ProviderId,
  KeyStatus,
  KeyMetadata,
  KeyValidationResult,
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  KeyStorage,
  ModelInfo,
  ModelFilter,
} from './types';
import { EventEmitter } from './provider';
import { createStorage } from './storage';

// -----------------------------------------------------------------------------
// Default Configuration
// -----------------------------------------------------------------------------

const DEFAULT_CONFIG: Required<Omit<BYOKClientConfig, 'providers' | 'storage' | 'proxyUrl' | 'modelConfig' | 'globalModelFilter'>> = {
  autoValidate: true,
  validationCacheTTL: 60 * 60 * 1000, // 1 hour
};

// -----------------------------------------------------------------------------
// BYOK Client Implementation
// -----------------------------------------------------------------------------

export class BYOKClientImpl implements BYOKClient {
  private providers = new Map<ProviderId, LLMProvider>();
  private storage: KeyStorage;
  private emitter = new EventEmitter();
  private config: Required<Omit<BYOKClientConfig, 'providers' | 'storage' | 'proxyUrl' | 'modelConfig' | 'globalModelFilter'>> &
                  Pick<BYOKClientConfig, 'proxyUrl' | 'modelConfig' | 'globalModelFilter'>;
  
  private state: BYOKState = {
    keys: {} as Record<ProviderId, KeyStatus>,
    providers: [],
    initialized: false,
  };
  
  constructor(config: BYOKClientConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.storage = createStorage(config.storage);
    
    // Register providers
    for (const provider of config.providers) {
      this.registerProvider(provider);
    }
  }
  
  // ---------------------------------------------------------------------------
  // Provider Management
  // ---------------------------------------------------------------------------
  
  private registerProvider(provider: LLMProvider): void {
    const id = provider.config.id;
    
    if (this.providers.has(id)) {
      console.warn(`Provider ${id} already registered, replacing`);
    }
    
    this.providers.set(id, provider);
    
    // Initialize state for this provider
    this.state.keys[id] = {
      hasKey: false,
      isValid: null,
      isValidating: false,
    };
    
    this.state.providers = Array.from(this.providers.keys());
    
    this.emit({ type: 'provider:added', providerId: id });
  }
  
  getProvider(providerId: ProviderId): LLMProvider | undefined {
    return this.providers.get(providerId);
  }
  
  listProviders(): LLMProvider[] {
    return Array.from(this.providers.values());
  }
  
  // ---------------------------------------------------------------------------
  // Key Management
  // ---------------------------------------------------------------------------
  
  async setKey(
    providerId: ProviderId, 
    key: string, 
    metadata?: KeyMetadata
  ): Promise<KeyValidationResult> {
    const provider = this.providers.get(providerId);
    
    if (!provider) {
      return {
        valid: false,
        providerId,
        error: `Provider ${providerId} not found`,
        errorCode: 'provider_not_found',
      };
    }
    
    // Update state to validating
    this.updateKeyStatus(providerId, {
      hasKey: true,
      isValid: null,
      isValidating: true,
    });
    
    this.emit({ type: 'key:validating', providerId });
    
    try {
      // Validate the key
      const result = await provider.validateKey(key);
      
      if (result.valid) {
        // Store the key
        await this.storage.set(providerId, key, metadata);

        // Initialize the provider with the key
        provider.initialize(key);

        // Filter and cache models if available
        const filteredModels = result.models
          ? this.applyModelFilters(providerId, result.models)
          : [];
        const defaultModel = this.getDefaultModel(providerId, filteredModels);

        // Update state
        this.updateKeyStatus(providerId, {
          hasKey: true,
          isValid: true,
          isValidating: false,
          lastValidated: Date.now(),
          models: filteredModels,
          selectedModel: defaultModel,
        });

        this.emit({ type: 'key:set', providerId, valid: true });
        this.emit({ type: 'key:validated', providerId, result });
      } else {
        // Update state with error
        this.updateKeyStatus(providerId, {
          hasKey: false,
          isValid: false,
          isValidating: false,
          error: result.error,
        });
        
        this.emit({ type: 'key:set', providerId, valid: false });
        this.emit({ type: 'key:validated', providerId, result });
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.updateKeyStatus(providerId, {
        hasKey: false,
        isValid: false,
        isValidating: false,
        error: errorMessage,
      });
      
      const result: KeyValidationResult = {
        valid: false,
        providerId,
        error: errorMessage,
        errorCode: 'validation_failed',
      };
      
      this.emit({ type: 'key:validated', providerId, result });
      
      return result;
    }
  }
  
  async removeKey(providerId: ProviderId): Promise<void> {
    await this.storage.remove(providerId);
    
    // Reset provider
    const provider = this.providers.get(providerId);
    if (provider) {
      // Re-create provider to clear internal state
      // (providers don't have a reset method, they just don't use the key)
    }
    
    this.updateKeyStatus(providerId, {
      hasKey: false,
      isValid: null,
      isValidating: false,
      error: undefined,
      lastValidated: undefined,
      models: undefined,
      selectedModel: undefined,
    });

    this.emit({ type: 'key:removed', providerId });
  }
  
  hasKey(providerId: ProviderId): boolean {
    return this.state.keys[providerId]?.hasKey ?? false;
  }
  
  getKeyStatus(providerId: ProviderId): KeyStatus | undefined {
    return this.state.keys[providerId];
  }
  
  async validateKey(providerId: ProviderId): Promise<KeyValidationResult> {
    const provider = this.providers.get(providerId);
    
    if (!provider) {
      return {
        valid: false,
        providerId,
        error: `Provider ${providerId} not found`,
        errorCode: 'provider_not_found',
      };
    }
    
    const stored = await this.storage.get(providerId);
    
    if (!stored) {
      return {
        valid: false,
        providerId,
        error: 'No key stored for this provider',
        errorCode: 'no_key',
      };
    }
    
    // Check cache
    const status = this.state.keys[providerId];
    if (
      status?.isValid !== null && 
      status?.lastValidated &&
      Date.now() - status.lastValidated < this.config.validationCacheTTL
    ) {
      return {
        valid: status.isValid,
        providerId,
      };
    }
    
    // Re-validate
    return this.setKey(providerId, stored.key, stored.metadata);
  }
  
  // ---------------------------------------------------------------------------
  // Chat API
  // ---------------------------------------------------------------------------
  
  async chat(providerId: ProviderId, request: ChatRequest): Promise<ChatResponse> {
    const provider = this.getInitializedProvider(providerId);
    return provider.chat(request);
  }
  
  async *chatStream(providerId: ProviderId, request: ChatRequest): AsyncIterable<ChatStreamChunk> {
    const provider = this.getInitializedProvider(providerId);
    yield* provider.chatStream(request);
  }
  
  private getInitializedProvider(providerId: ProviderId): LLMProvider {
    const provider = this.providers.get(providerId);

    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    if (provider.config.requiresKey && !provider.isInitialized()) {
      throw new Error(`Provider ${providerId} not initialized with API key`);
    }

    return provider;
  }

  // ---------------------------------------------------------------------------
  // Model Management
  // ---------------------------------------------------------------------------

  getModels(providerId: ProviderId): ModelInfo[] {
    return this.state.keys[providerId]?.models ?? [];
  }

  selectModel(providerId: ProviderId, modelId: string): void {
    const models = this.getModels(providerId);
    if (!models.find(m => m.id === modelId)) {
      throw new Error(`Model ${modelId} not available for provider ${providerId}`);
    }
    this.updateKeyStatus(providerId, { selectedModel: modelId });
    this.emit({ type: 'model:selected', providerId, modelId });
  }

  getSelectedModel(providerId: ProviderId): string | undefined {
    return this.state.keys[providerId]?.selectedModel;
  }

  async refreshModels(providerId: ProviderId): Promise<ModelInfo[]> {
    const provider = this.providers.get(providerId);
    if (!provider?.isInitialized()) {
      throw new Error(`Provider ${providerId} not initialized`);
    }
    const models = await provider.listModels();
    const filtered = this.applyModelFilters(providerId, models);
    this.updateKeyStatus(providerId, { models: filtered });
    this.emit({ type: 'models:refreshed', providerId, models: filtered });
    return filtered;
  }

  private applyModelFilters(providerId: ProviderId, models: ModelInfo[]): ModelInfo[] {
    let result = [...models];

    // Apply global filter
    if (this.config.globalModelFilter) {
      result = this.applyFilter(result, this.config.globalModelFilter);
    }

    // Apply provider-specific filter
    const providerConfig = this.config.modelConfig?.[providerId];
    if (providerConfig?.filter) {
      result = this.applyFilter(result, providerConfig.filter);
    }

    return result;
  }

  private applyFilter(models: ModelInfo[], filter: ModelFilter): ModelInfo[] {
    let result = [...models];

    // Include patterns
    if (filter.include?.length) {
      result = result.filter(m =>
        filter.include!.some(pattern => this.matchesPattern(m.id, pattern))
      );
    }

    // Exclude patterns
    if (filter.exclude?.length) {
      result = result.filter(m =>
        !filter.exclude!.some(pattern => this.matchesPattern(m.id, pattern))
      );
    }

    // Required capabilities
    if (filter.requiredCapabilities?.length) {
      result = result.filter(m =>
        filter.requiredCapabilities!.every(cap => m.capabilities?.[cap])
      );
    }

    // Custom filter function
    if (filter.filter) {
      result = result.filter(filter.filter);
    }

    return result;
  }

  private matchesPattern(id: string, pattern: string): boolean {
    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
      .replace(/\*/g, '.*'); // Convert * to .*
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(id);
  }

  private getDefaultModel(providerId: ProviderId, models: ModelInfo[]): string | undefined {
    if (models.length === 0) return undefined;

    // Check provider config for default
    const providerConfig = this.config.modelConfig?.[providerId];
    if (providerConfig?.defaultModel) {
      const found = models.find(m => m.id === providerConfig.defaultModel);
      if (found) return found.id;
    }

    // Return first model
    return models[0]?.id;
  }

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------
  
  getState(): BYOKState {
    return { ...this.state };
  }
  
  subscribe(listener: BYOKEventListener): Unsubscribe {
    return this.emitter.subscribe(listener);
  }
  
  private updateKeyStatus(providerId: ProviderId, status: Partial<KeyStatus>): void {
    const current = this.state.keys[providerId] ?? {
      hasKey: false,
      isValid: null,
      isValidating: false,
    };
    
    this.state.keys[providerId] = { ...current, ...status };
    
    this.emit({ type: 'state:changed', state: this.getState() });
  }
  
  private emit(event: BYOKEvent): void {
    this.emitter.emit(event);
  }
  
  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  
  async initialize(): Promise<void> {
    if (this.state.initialized) return;
    
    // Load stored keys
    const storedKeys = await this.storage.list();
    
    for (const stored of storedKeys) {
      const provider = this.providers.get(stored.providerId);
      
      if (provider) {
        // Initialize provider with stored key
        provider.initialize(stored.key);
        
        // Update state
        this.updateKeyStatus(stored.providerId, {
          hasKey: true,
          isValid: stored.isValid ?? null,
          isValidating: false,
          lastValidated: stored.validatedAt,
        });
        
        // Optionally re-validate
        if (this.config.autoValidate) {
          this.validateKey(stored.providerId).catch(console.error);
        }
      }
    }
    
    this.state.initialized = true;
    this.emit({ type: 'state:changed', state: this.getState() });
  }
  
  async destroy(): Promise<void> {
    this.emitter.clear();
    this.providers.clear();
    this.state = {
      keys: {} as Record<ProviderId, KeyStatus>,
      providers: [],
      initialized: false,
    };
  }
}

// -----------------------------------------------------------------------------
// Factory Function
// -----------------------------------------------------------------------------

export function createBYOKClient(config: BYOKClientConfig): BYOKClient {
  return new BYOKClientImpl(config);
}
