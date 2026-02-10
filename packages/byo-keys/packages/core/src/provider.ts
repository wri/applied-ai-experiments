// =============================================================================
// Event Emitter
// =============================================================================

import type { BYOKEvent, BYOKEventListener, Unsubscribe } from './types';

export class EventEmitter {
  private listeners = new Set<BYOKEventListener>();
  
  subscribe(listener: BYOKEventListener): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  emit(event: BYOKEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    });
  }
  
  clear(): void {
    this.listeners.clear();
  }
}

// =============================================================================
// Base Provider
// =============================================================================

import type {
  LLMProvider,
  ProviderConfig,
  ProviderCapabilities,
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  KeyValidationResult,
  ModelInfo,
} from './types';

export interface BaseProviderOptions {
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

export abstract class BaseProvider implements LLMProvider {
  abstract readonly config: ProviderConfig;
  abstract readonly capabilities: ProviderCapabilities;
  
  protected apiKey: string | null = null;
  protected options: BaseProviderOptions;
  protected fetchFn: typeof fetch;
  
  constructor(options: BaseProviderOptions = {}) {
    this.options = options;
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  }
  
  initialize(key: string): void {
    this.apiKey = key;
  }
  
  isInitialized(): boolean {
    return this.apiKey !== null;
  }
  
  protected getApiKey(): string {
    if (!this.apiKey) {
      throw new Error(`Provider ${this.config.id} not initialized with API key`);
    }
    return this.apiKey;
  }
  
  protected getBaseUrl(): string {
    return this.options.baseUrl ?? this.options.proxyUrl ?? this.config.baseUrl;
  }
  
  protected async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    
    const headers = new Headers(options.headers);
    
    // Add authorization
    this.addAuthHeaders(headers);
    
    // Add custom headers
    if (this.options.headers) {
      Object.entries(this.options.headers).forEach(([key, value]) => {
        headers.set(key, value);
      });
    }
    
    // Add content type if not set and we have a body
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    
    const controller = new AbortController();
    const timeoutId = this.options.timeout
      ? setTimeout(() => controller.abort(), this.options.timeout)
      : null;
    
    try {
      const response = await this.fetchFn(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      
      if (!response.ok) {
        const error = await this.parseError(response);
        throw error;
      }
      
      return response.json() as Promise<T>;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }
  
  protected async *requestStream(
    endpoint: string,
    options: RequestInit = {}
  ): AsyncIterable<string> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    
    const headers = new Headers(options.headers);
    this.addAuthHeaders(headers);
    
    if (this.options.headers) {
      Object.entries(this.options.headers).forEach(([key, value]) => {
        headers.set(key, value);
      });
    }
    
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    
    const response = await this.fetchFn(url, {
      ...options,
      headers,
    });
    
    if (!response.ok) {
      const error = await this.parseError(response);
      throw error;
    }
    
    if (!response.body) {
      throw new Error('No response body for streaming request');
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
  protected addAuthHeaders(headers: Headers): void {
    headers.set('Authorization', `Bearer ${this.getApiKey()}`);
  }
  
  /**
   * Parse error response - override in subclasses for provider-specific errors
   */
  protected async parseError(response: Response): Promise<Error> {
    let message = `HTTP ${response.status}: ${response.statusText}`;
    
    try {
      const body = await response.json();
      if (body.error?.message) {
        message = body.error.message;
      } else if (body.message) {
        message = body.message;
      }
    } catch {
      // Use default message
    }
    
    return new Error(message);
  }
  
  // Abstract methods to be implemented by subclasses
  abstract validateKey(key: string): Promise<KeyValidationResult>;
  abstract listModels(): Promise<ModelInfo[]>;
  abstract chat(request: ChatRequest): Promise<ChatResponse>;
  abstract chatStream(request: ChatRequest): AsyncIterable<ChatStreamChunk>;
}

// =============================================================================
// SSE Parser Utility
// =============================================================================

/**
 * Parse Server-Sent Events stream
 */
export async function* parseSSE(
  stream: AsyncIterable<string>
): AsyncIterable<{ event?: string; data: string }> {
  let buffer = '';
  
  for await (const chunk of stream) {
    buffer += chunk;
    
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    
    let event: string | undefined;
    let data: string[] = [];
    
    for (const line of lines) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        data.push(line.slice(5).trim());
      } else if (line === '') {
        if (data.length > 0) {
          yield { event, data: data.join('\n') };
          event = undefined;
          data = [];
        }
      }
    }
  }
  
  // Handle any remaining data
  if (buffer.trim()) {
    const lines = buffer.split('\n');
    let event: string | undefined;
    let data: string[] = [];
    
    for (const line of lines) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        data.push(line.slice(5).trim());
      }
    }
    
    if (data.length > 0) {
      yield { event, data: data.join('\n') };
    }
  }
}
