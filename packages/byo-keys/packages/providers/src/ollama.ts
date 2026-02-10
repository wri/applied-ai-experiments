// =============================================================================
// Ollama Provider (Local Inference)
// =============================================================================

import { BaseProvider, type BaseProviderOptions } from '@byo-keys/core';
import type {
  ProviderConfig,
  ProviderCapabilities,
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  KeyValidationResult,
  ModelInfo,
} from '@byo-keys/core';

// -----------------------------------------------------------------------------
// Ollama-specific Types
// -----------------------------------------------------------------------------

interface OllamaMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[]; // base64 encoded images
}

interface OllamaRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    stop?: string[];
  };
}

interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: 'assistant';
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaModelsResponse {
  models: Array<{
    name: string;
    modified_at: string;
    size: number;
    digest: string;
    details?: {
      format: string;
      family: string;
      families: string[];
      parameter_size: string;
      quantization_level: string;
    };
  }>;
}

// -----------------------------------------------------------------------------
// Provider Options
// -----------------------------------------------------------------------------

export interface OllamaProviderOptions extends BaseProviderOptions {
  /** 
   * Ollama server URL 
   * @default 'http://localhost:11434'
   */
  baseUrl?: string;
}

// -----------------------------------------------------------------------------
// Ollama Provider Implementation
// -----------------------------------------------------------------------------

export class OllamaProvider extends BaseProvider {
  readonly config: ProviderConfig;
  
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    streaming: true,
    embeddings: true,
    images: false,
    audio: false,
    vision: true, // Many Ollama models support vision
    functionCalling: false,
    extendedThinking: false,
  };
  
  constructor(options: OllamaProviderOptions = {}) {
    super(options);
    
    this.config = {
      id: 'ollama',
      name: 'Ollama (Local)',
      requiresKey: false, // Ollama doesn't require API keys
      supportsCORS: true, // Local server, CORS configurable
      baseUrl: options.baseUrl ?? 'http://localhost:11434',
    };
  }
  
  // Override to not require auth headers
  protected addAuthHeaders(_headers: Headers): void {
    // Ollama doesn't need authentication
  }
  
  // Override initialize since no key is needed
  initialize(_key?: string): void {
    // No-op for Ollama
  }
  
  isInitialized(): boolean {
    return true; // Always "initialized" since no key needed
  }
  
  protected getApiKey(): string {
    return ''; // No key needed
  }
  
  async validateKey(_key: string): Promise<KeyValidationResult> {
    // For Ollama, "validation" means checking if the server is reachable
    try {
      const models = await this.listModels();
      
      return {
        valid: true,
        providerId: 'ollama',
        models,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        valid: false,
        providerId: 'ollama',
        error: `Cannot connect to Ollama server: ${message}`,
        errorCode: 'network_error',
      };
    }
  }
  
  /**
   * Check if Ollama server is running and reachable
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.listModels();
      return true;
    } catch {
      return false;
    }
  }
  
  async listModels(): Promise<ModelInfo[]> {
    const response = await this.request<OllamaModelsResponse>('/api/tags');
    
    return response.models.map(m => ({
      id: m.name,
      name: this.formatModelName(m.name),
      provider: 'ollama' as const,
      contextWindow: this.estimateContextWindow(m.details?.parameter_size),
      capabilities: {
        vision: this.supportsVision(m.name),
      },
    }));
  }
  
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const ollamaRequest = this.toOllamaRequest({ ...request, stream: false });
    
    const response = await this.request<OllamaResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify(ollamaRequest),
    });
    
    return this.fromOllamaResponse(response, request.model);
  }
  
  async *chatStream(request: ChatRequest): AsyncIterable<ChatStreamChunk> {
    const ollamaRequest = this.toOllamaRequest({ ...request, stream: true });
    
    const url = `${this.getBaseUrl()}/api/chat`;
    
    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ollamaRequest),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    if (!response.body) {
      throw new Error('No response body');
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let started = false;
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const chunk: OllamaResponse = JSON.parse(line);
            
            if (!started) {
              started = true;
              yield {
                type: 'start',
                id: `ollama-${Date.now()}`,
                model: chunk.model,
              };
            }
            
            if (chunk.message?.content) {
              yield { type: 'delta', content: chunk.message.content };
            }
            
            if (chunk.done) {
              yield { type: 'done', finishReason: 'stop' };
              
              if (chunk.eval_count !== undefined) {
                yield {
                  type: 'usage',
                  usage: {
                    inputTokens: chunk.prompt_eval_count ?? 0,
                    outputTokens: chunk.eval_count,
                  },
                };
              }
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
  
  // ---------------------------------------------------------------------------
  // Model Management (Ollama-specific)
  // ---------------------------------------------------------------------------
  
  /**
   * Pull a model from the Ollama library
   */
  async pullModel(modelName: string, onProgress?: (status: string) => void): Promise<void> {
    const url = `${this.getBaseUrl()}/api/pull`;
    
    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.statusText}`);
    }
    
    if (!response.body) return;
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const status = JSON.parse(line);
            onProgress?.(status.status);
          } catch {
            // Skip
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
  
  /**
   * Delete a local model
   */
  async deleteModel(modelName: string): Promise<void> {
    await this.request('/api/delete', {
      method: 'DELETE',
      body: JSON.stringify({ name: modelName }),
    });
  }
  
  // ---------------------------------------------------------------------------
  // Conversion Helpers
  // ---------------------------------------------------------------------------
  
  private toOllamaRequest(request: ChatRequest): OllamaRequest {
    const messages = this.convertMessages(request);
    
    return {
      model: request.model,
      messages,
      stream: request.stream,
      options: {
        temperature: request.temperature,
        top_p: request.topP,
        top_k: request.topK,
        num_predict: request.maxTokens,
        stop: request.stopSequences,
      },
    };
  }
  
  private convertMessages(request: ChatRequest): OllamaMessage[] {
    const messages: OllamaMessage[] = [];
    
    if (request.system) {
      messages.push({ role: 'system', content: request.system });
    }
    
    for (const msg of request.messages) {
      const converted: OllamaMessage = {
        role: msg.role,
        content: '',
      };
      
      if (typeof msg.content === 'string') {
        converted.content = msg.content;
      } else {
        const textParts: string[] = [];
        const images: string[] = [];
        
        for (const part of msg.content) {
          if (part.type === 'text') {
            textParts.push(part.text);
          } else if (part.type === 'image' && part.source.type === 'base64') {
            images.push(part.source.data);
          }
        }
        
        converted.content = textParts.join('\n');
        if (images.length > 0) {
          converted.images = images;
        }
      }
      
      messages.push(converted);
    }
    
    return messages;
  }
  
  private fromOllamaResponse(response: OllamaResponse, model: string): ChatResponse {
    return {
      id: `ollama-${Date.now()}`,
      model,
      content: response.message.content,
      finishReason: 'stop',
      usage: {
        inputTokens: response.prompt_eval_count ?? 0,
        outputTokens: response.eval_count ?? 0,
        totalTokens: (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0),
      },
      raw: response,
    };
  }
  
  private formatModelName(name: string): string {
    // Convert "llama3:8b" to "Llama 3 (8B)"
    const [base, variant] = name.split(':');
    const formatted = (base ?? name)
      .replace(/(\d+)/g, ' $1 ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    
    return variant ? `${formatted} (${variant.toUpperCase()})` : formatted;
  }
  
  private estimateContextWindow(paramSize?: string): number {
    if (!paramSize) return 4096;
    
    const size = parseFloat(paramSize);
    if (size >= 70) return 32768;
    if (size >= 30) return 16384;
    if (size >= 7) return 8192;
    return 4096;
  }
  
  private supportsVision(name: string): boolean {
    const visionModels = ['llava', 'bakllava', 'moondream', 'cogvlm'];
    return visionModels.some(v => name.toLowerCase().includes(v));
  }
}

// -----------------------------------------------------------------------------
// Factory Function
// -----------------------------------------------------------------------------

export function ollama(options?: OllamaProviderOptions): OllamaProvider {
  return new OllamaProvider(options);
}
