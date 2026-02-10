// src/types.ts
var BYOKError = class extends Error {
  constructor(message, code, providerId, cause) {
    super(message);
    this.code = code;
    this.providerId = providerId;
    this.cause = cause;
    this.name = "BYOKError";
  }
};

// src/provider.ts
var EventEmitter = class {
  listeners = /* @__PURE__ */ new Set();
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit(event) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("Error in event listener:", error);
      }
    });
  }
  clear() {
    this.listeners.clear();
  }
};
var BaseProvider = class {
  apiKey = null;
  options;
  fetchFn;
  constructor(options = {}) {
    this.options = options;
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  }
  initialize(key) {
    this.apiKey = key;
  }
  isInitialized() {
    return this.apiKey !== null;
  }
  getApiKey() {
    if (!this.apiKey) {
      throw new Error(`Provider ${this.config.id} not initialized with API key`);
    }
    return this.apiKey;
  }
  getBaseUrl() {
    return this.options.baseUrl ?? this.options.proxyUrl ?? this.config.baseUrl;
  }
  async request(endpoint, options = {}) {
    const url = `${this.getBaseUrl()}${endpoint}`;
    const headers = new Headers(options.headers);
    this.addAuthHeaders(headers);
    if (this.options.headers) {
      Object.entries(this.options.headers).forEach(([key, value]) => {
        headers.set(key, value);
      });
    }
    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const controller = new AbortController();
    const timeoutId = this.options.timeout ? setTimeout(() => controller.abort(), this.options.timeout) : null;
    try {
      const response = await this.fetchFn(url, {
        ...options,
        headers,
        signal: controller.signal
      });
      if (!response.ok) {
        const error = await this.parseError(response);
        throw error;
      }
      return response.json();
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }
  async *requestStream(endpoint, options = {}) {
    const url = `${this.getBaseUrl()}${endpoint}`;
    const headers = new Headers(options.headers);
    this.addAuthHeaders(headers);
    if (this.options.headers) {
      Object.entries(this.options.headers).forEach(([key, value]) => {
        headers.set(key, value);
      });
    }
    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const response = await this.fetchFn(url, {
      ...options,
      headers
    });
    if (!response.ok) {
      const error = await this.parseError(response);
      throw error;
    }
    if (!response.body) {
      throw new Error("No response body for streaming request");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield decoder.decode(value, { stream: true });
      }
    } finally {
      reader.releaseLock();
    }
  }
  /**
   * Add authorization headers - override in subclasses for different auth schemes
   */
  addAuthHeaders(headers) {
    headers.set("Authorization", `Bearer ${this.getApiKey()}`);
  }
  /**
   * Parse error response - override in subclasses for provider-specific errors
   */
  async parseError(response) {
    let message = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const body = await response.json();
      if (body.error?.message) {
        message = body.error.message;
      } else if (body.message) {
        message = body.message;
      }
    } catch {
    }
    return new Error(message);
  }
};
async function* parseSSE(stream) {
  let buffer = "";
  for await (const chunk of stream) {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    let event;
    let data = [];
    for (const line of lines) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        data.push(line.slice(5).trim());
      } else if (line === "") {
        if (data.length > 0) {
          yield { event, data: data.join("\n") };
          event = void 0;
          data = [];
        }
      }
    }
  }
  if (buffer.trim()) {
    const lines = buffer.split("\n");
    let event;
    let data = [];
    for (const line of lines) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        data.push(line.slice(5).trim());
      }
    }
    if (data.length > 0) {
      yield { event, data: data.join("\n") };
    }
  }
}

// src/storage.ts
var DEFAULT_PREFIX = "byok-llm:keys:";
function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}
function assertBrowser() {
  if (!isBrowser()) {
    throw new Error(
      "BYOK storage requires a browser environment. Use MemoryStorage for SSR or testing."
    );
  }
}
var MemoryStorage = class {
  store = /* @__PURE__ */ new Map();
  async get(providerId) {
    return this.store.get(providerId) ?? null;
  }
  async set(providerId, key, metadata) {
    this.store.set(providerId, {
      providerId,
      key,
      addedAt: Date.now(),
      metadata
    });
  }
  async remove(providerId) {
    this.store.delete(providerId);
  }
  async list() {
    return Array.from(this.store.values());
  }
  async clear() {
    this.store.clear();
  }
};
var LocalStorage = class {
  prefix;
  backend;
  constructor(options = {}) {
    assertBrowser();
    this.prefix = options.prefix ?? DEFAULT_PREFIX;
    this.backend = options.backend === "sessionStorage" ? window.sessionStorage : window.localStorage;
  }
  getStorageKey(providerId) {
    return `${this.prefix}${providerId}`;
  }
  async get(providerId) {
    const raw = this.backend.getItem(this.getStorageKey(providerId));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      this.backend.removeItem(this.getStorageKey(providerId));
      return null;
    }
  }
  async set(providerId, key, metadata) {
    const stored = {
      providerId,
      key,
      addedAt: Date.now(),
      metadata
    };
    this.backend.setItem(this.getStorageKey(providerId), JSON.stringify(stored));
  }
  async remove(providerId) {
    this.backend.removeItem(this.getStorageKey(providerId));
  }
  async list() {
    const keys = [];
    for (let i = 0; i < this.backend.length; i++) {
      const storageKey = this.backend.key(i);
      if (storageKey?.startsWith(this.prefix)) {
        const raw = this.backend.getItem(storageKey);
        if (raw) {
          try {
            keys.push(JSON.parse(raw));
          } catch {
          }
        }
      }
    }
    return keys;
  }
  async clear() {
    const keysToRemove = [];
    for (let i = 0; i < this.backend.length; i++) {
      const storageKey = this.backend.key(i);
      if (storageKey?.startsWith(this.prefix)) {
        keysToRemove.push(storageKey);
      }
    }
    keysToRemove.forEach((key) => this.backend.removeItem(key));
  }
};
var EncryptedStorage = class {
  prefix;
  backend;
  cryptoKey = null;
  salt;
  constructor(options = {}) {
    assertBrowser();
    if (!window.crypto?.subtle) {
      throw new Error("Web Crypto API not available. Cannot use encrypted storage.");
    }
    this.prefix = options.prefix ?? `${DEFAULT_PREFIX}encrypted:`;
    this.backend = options.backend === "sessionStorage" ? window.sessionStorage : window.localStorage;
    const saltKey = `${this.prefix}__salt__`;
    const storedSalt = this.backend.getItem(saltKey);
    if (storedSalt) {
      this.salt = new Uint8Array(JSON.parse(storedSalt));
    } else {
      this.salt = crypto.getRandomValues(new Uint8Array(16));
      this.backend.setItem(saltKey, JSON.stringify(Array.from(this.salt)));
    }
  }
  /**
   * Derive an encryption key from a passphrase
   */
  async setEncryptionKey(passphrase) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(passphrase),
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"]
    );
    this.cryptoKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: this.salt,
        iterations: 1e5,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }
  clearEncryptionKey() {
    this.cryptoKey = null;
  }
  isEncrypted() {
    return this.cryptoKey !== null;
  }
  assertEncrypted() {
    if (!this.cryptoKey) {
      throw new Error(
        "Encryption key not set. Call setEncryptionKey(passphrase) first."
      );
    }
  }
  async encrypt(data) {
    this.assertEncrypted();
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      this.cryptoKey,
      encoder.encode(data)
    );
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
  }
  async decrypt(data) {
    this.assertEncrypted();
    const combined = new Uint8Array(
      atob(data).split("").map((c) => c.charCodeAt(0))
    );
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      this.cryptoKey,
      encrypted
    );
    return new TextDecoder().decode(decrypted);
  }
  getStorageKey(providerId) {
    return `${this.prefix}${providerId}`;
  }
  async get(providerId) {
    this.assertEncrypted();
    const raw = this.backend.getItem(this.getStorageKey(providerId));
    if (!raw) return null;
    try {
      const decrypted = await this.decrypt(raw);
      return JSON.parse(decrypted);
    } catch {
      return null;
    }
  }
  async set(providerId, key, metadata) {
    this.assertEncrypted();
    const stored = {
      providerId,
      key,
      addedAt: Date.now(),
      metadata
    };
    const encrypted = await this.encrypt(JSON.stringify(stored));
    this.backend.setItem(this.getStorageKey(providerId), encrypted);
  }
  async remove(providerId) {
    this.backend.removeItem(this.getStorageKey(providerId));
  }
  async list() {
    this.assertEncrypted();
    const keys = [];
    for (let i = 0; i < this.backend.length; i++) {
      const storageKey = this.backend.key(i);
      if (storageKey?.startsWith(this.prefix) && !storageKey.endsWith("__salt__")) {
        const raw = this.backend.getItem(storageKey);
        if (raw) {
          try {
            const decrypted = await this.decrypt(raw);
            keys.push(JSON.parse(decrypted));
          } catch {
          }
        }
      }
    }
    return keys;
  }
  async clear() {
    const keysToRemove = [];
    for (let i = 0; i < this.backend.length; i++) {
      const storageKey = this.backend.key(i);
      if (storageKey?.startsWith(this.prefix)) {
        keysToRemove.push(storageKey);
      }
    }
    keysToRemove.forEach((key) => this.backend.removeItem(key));
  }
};
function createStorage(options) {
  if (options && "get" in options && typeof options.get === "function") {
    return options;
  }
  const opts = options ?? {};
  if (!isBrowser()) {
    return new MemoryStorage();
  }
  if (opts.encrypted) {
    return new EncryptedStorage(opts);
  }
  return new LocalStorage(opts);
}

// src/client.ts
var DEFAULT_CONFIG = {
  autoValidate: true,
  validationCacheTTL: 60 * 60 * 1e3
  // 1 hour
};
var BYOKClientImpl = class {
  providers = /* @__PURE__ */ new Map();
  storage;
  emitter = new EventEmitter();
  config;
  state = {
    keys: {},
    providers: [],
    initialized: false
  };
  constructor(config) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.storage = createStorage(config.storage);
    for (const provider of config.providers) {
      this.registerProvider(provider);
    }
  }
  // ---------------------------------------------------------------------------
  // Provider Management
  // ---------------------------------------------------------------------------
  registerProvider(provider) {
    const id = provider.config.id;
    if (this.providers.has(id)) {
      console.warn(`Provider ${id} already registered, replacing`);
    }
    this.providers.set(id, provider);
    this.state.keys[id] = {
      hasKey: false,
      isValid: null,
      isValidating: false
    };
    this.state.providers = Array.from(this.providers.keys());
    this.emit({ type: "provider:added", providerId: id });
  }
  getProvider(providerId) {
    return this.providers.get(providerId);
  }
  listProviders() {
    return Array.from(this.providers.values());
  }
  // ---------------------------------------------------------------------------
  // Key Management
  // ---------------------------------------------------------------------------
  async setKey(providerId, key, metadata) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return {
        valid: false,
        providerId,
        error: `Provider ${providerId} not found`,
        errorCode: "provider_not_found"
      };
    }
    this.updateKeyStatus(providerId, {
      hasKey: true,
      isValid: null,
      isValidating: true
    });
    this.emit({ type: "key:validating", providerId });
    try {
      const result = await provider.validateKey(key);
      if (result.valid) {
        await this.storage.set(providerId, key, metadata);
        provider.initialize(key);
        const filteredModels = result.models ? this.applyModelFilters(providerId, result.models) : [];
        const defaultModel = this.getDefaultModel(providerId, filteredModels);
        this.updateKeyStatus(providerId, {
          hasKey: true,
          isValid: true,
          isValidating: false,
          lastValidated: Date.now(),
          models: filteredModels,
          selectedModel: defaultModel
        });
        this.emit({ type: "key:set", providerId, valid: true });
        this.emit({ type: "key:validated", providerId, result });
      } else {
        this.updateKeyStatus(providerId, {
          hasKey: false,
          isValid: false,
          isValidating: false,
          error: result.error
        });
        this.emit({ type: "key:set", providerId, valid: false });
        this.emit({ type: "key:validated", providerId, result });
      }
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.updateKeyStatus(providerId, {
        hasKey: false,
        isValid: false,
        isValidating: false,
        error: errorMessage
      });
      const result = {
        valid: false,
        providerId,
        error: errorMessage,
        errorCode: "validation_failed"
      };
      this.emit({ type: "key:validated", providerId, result });
      return result;
    }
  }
  async removeKey(providerId) {
    await this.storage.remove(providerId);
    const provider = this.providers.get(providerId);
    if (provider) {
    }
    this.updateKeyStatus(providerId, {
      hasKey: false,
      isValid: null,
      isValidating: false,
      error: void 0,
      lastValidated: void 0,
      models: void 0,
      selectedModel: void 0
    });
    this.emit({ type: "key:removed", providerId });
  }
  hasKey(providerId) {
    return this.state.keys[providerId]?.hasKey ?? false;
  }
  getKeyStatus(providerId) {
    return this.state.keys[providerId];
  }
  async validateKey(providerId) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return {
        valid: false,
        providerId,
        error: `Provider ${providerId} not found`,
        errorCode: "provider_not_found"
      };
    }
    const stored = await this.storage.get(providerId);
    if (!stored) {
      return {
        valid: false,
        providerId,
        error: "No key stored for this provider",
        errorCode: "no_key"
      };
    }
    const status = this.state.keys[providerId];
    if (status?.isValid !== null && status?.lastValidated && Date.now() - status.lastValidated < this.config.validationCacheTTL) {
      return {
        valid: status.isValid,
        providerId
      };
    }
    return this.setKey(providerId, stored.key, stored.metadata);
  }
  // ---------------------------------------------------------------------------
  // Chat API
  // ---------------------------------------------------------------------------
  async chat(providerId, request) {
    const provider = this.getInitializedProvider(providerId);
    return provider.chat(request);
  }
  async *chatStream(providerId, request) {
    const provider = this.getInitializedProvider(providerId);
    yield* provider.chatStream(request);
  }
  getInitializedProvider(providerId) {
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
  getModels(providerId) {
    return this.state.keys[providerId]?.models ?? [];
  }
  selectModel(providerId, modelId) {
    const models = this.getModels(providerId);
    if (!models.find((m) => m.id === modelId)) {
      throw new Error(`Model ${modelId} not available for provider ${providerId}`);
    }
    this.updateKeyStatus(providerId, { selectedModel: modelId });
    this.emit({ type: "model:selected", providerId, modelId });
  }
  getSelectedModel(providerId) {
    return this.state.keys[providerId]?.selectedModel;
  }
  async refreshModels(providerId) {
    const provider = this.providers.get(providerId);
    if (!provider?.isInitialized()) {
      throw new Error(`Provider ${providerId} not initialized`);
    }
    const models = await provider.listModels();
    const filtered = this.applyModelFilters(providerId, models);
    this.updateKeyStatus(providerId, { models: filtered });
    this.emit({ type: "models:refreshed", providerId, models: filtered });
    return filtered;
  }
  applyModelFilters(providerId, models) {
    let result = [...models];
    if (this.config.globalModelFilter) {
      result = this.applyFilter(result, this.config.globalModelFilter);
    }
    const providerConfig = this.config.modelConfig?.[providerId];
    if (providerConfig?.filter) {
      result = this.applyFilter(result, providerConfig.filter);
    }
    return result;
  }
  applyFilter(models, filter) {
    let result = [...models];
    if (filter.include?.length) {
      result = result.filter(
        (m) => filter.include.some((pattern) => this.matchesPattern(m.id, pattern))
      );
    }
    if (filter.exclude?.length) {
      result = result.filter(
        (m) => !filter.exclude.some((pattern) => this.matchesPattern(m.id, pattern))
      );
    }
    if (filter.requiredCapabilities?.length) {
      result = result.filter(
        (m) => filter.requiredCapabilities.every((cap) => m.capabilities?.[cap])
      );
    }
    if (filter.filter) {
      result = result.filter(filter.filter);
    }
    return result;
  }
  matchesPattern(id, pattern) {
    const regexPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(id);
  }
  getDefaultModel(providerId, models) {
    if (models.length === 0) return void 0;
    const providerConfig = this.config.modelConfig?.[providerId];
    if (providerConfig?.defaultModel) {
      const found = models.find((m) => m.id === providerConfig.defaultModel);
      if (found) return found.id;
    }
    return models[0]?.id;
  }
  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------
  getState() {
    return { ...this.state };
  }
  subscribe(listener) {
    return this.emitter.subscribe(listener);
  }
  updateKeyStatus(providerId, status) {
    const current = this.state.keys[providerId] ?? {
      hasKey: false,
      isValid: null,
      isValidating: false
    };
    this.state.keys[providerId] = { ...current, ...status };
    this.emit({ type: "state:changed", state: this.getState() });
  }
  emit(event) {
    this.emitter.emit(event);
  }
  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  async initialize() {
    if (this.state.initialized) return;
    const storedKeys = await this.storage.list();
    for (const stored of storedKeys) {
      const provider = this.providers.get(stored.providerId);
      if (provider) {
        provider.initialize(stored.key);
        this.updateKeyStatus(stored.providerId, {
          hasKey: true,
          isValid: stored.isValid ?? null,
          isValidating: false,
          lastValidated: stored.validatedAt
        });
        if (this.config.autoValidate) {
          this.validateKey(stored.providerId).catch(console.error);
        }
      }
    }
    this.state.initialized = true;
    this.emit({ type: "state:changed", state: this.getState() });
  }
  async destroy() {
    this.emitter.clear();
    this.providers.clear();
    this.state = {
      keys: {},
      providers: [],
      initialized: false
    };
  }
};
function createBYOKClient(config) {
  return new BYOKClientImpl(config);
}
export {
  BYOKClientImpl,
  BYOKError,
  BaseProvider,
  EncryptedStorage,
  EventEmitter,
  LocalStorage,
  MemoryStorage,
  createBYOKClient,
  createStorage,
  parseSSE
};
