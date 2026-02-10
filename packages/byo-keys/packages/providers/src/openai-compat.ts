// =============================================================================
// OpenAI-Compatible Provider Base
// =============================================================================
// Many providers (Groq, Together, OpenRouter, etc.) use OpenAI-compatible APIs.
// This base class provides shared functionality for these providers.

import { BaseProvider, parseSSE, type BaseProviderOptions } from '@byo-keys/core';
import type {
  ProviderConfig,
  ProviderCapabilities,
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  KeyValidationResult,
  ModelInfo,
  ContentPart,
  FinishReason,
} from '@byo-keys/core';

// -----------------------------------------------------------------------------
// OpenAI-Compatible Types
// -----------------------------------------------------------------------------

interface OpenAICompatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | OpenAICompatContent[];
}

type OpenAICompatContent = 
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

interface OpenAICompatRequest {
  model: string;
  messages: OpenAICompatMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string[];
  stream?: boolean;
}

interface OpenAICompatResponse {
  id: string;
  object: 'chat.completion';
  model: string;
  choices: Array<{
    index: number;
    message: { role: 'assistant'; content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAICompatStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  model: string;
  choices: Array<{
    index: number;
    delta: { role?: string; content?: string };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAICompatModelsResponse {
  data: Array<{
    id: string;
    object: 'model';
    created?: number;
    owned_by?: string;
  }>;
}

// -----------------------------------------------------------------------------
// Provider Options
// -----------------------------------------------------------------------------

export interface OpenAICompatProviderOptions extends BaseProviderOptions {
  /** Default max tokens if not specified in request */
  defaultMaxTokens?: number;
}

// -----------------------------------------------------------------------------
// OpenAI-Compatible Provider Base
// -----------------------------------------------------------------------------

export abstract class OpenAICompatProvider extends BaseProvider {
  abstract readonly config: ProviderConfig;
  abstract readonly capabilities: ProviderCapabilities;
  
  protected compatOptions: OpenAICompatProviderOptions;
  
  constructor(options: OpenAICompatProviderOptions = {}) {
    super(options);
    this.compatOptions = {
      defaultMaxTokens: 4096,
      ...options,
    };
  }
  
  protected addAuthHeaders(headers: Headers): void {
    headers.set('Authorization', `Bearer ${this.getApiKey()}`);
  }
  
  async validateKey(key: string): Promise<KeyValidationResult> {
    const originalKey = this.apiKey;
    this.apiKey = key;
    
    try {
      const models = await this.listModels();
      
      return {
        valid: true,
        providerId: this.config.id,
        models,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const isAuthError = message.includes('401') || 
                          message.includes('invalid') ||
                          message.includes('unauthorized');
      
      return {
        valid: false,
        providerId: this.config.id,
        error: message,
        errorCode: isAuthError ? 'invalid_key' : 'provider_error',
      };
    } finally {
      this.apiKey = originalKey;
    }
  }
  
  async listModels(): Promise<ModelInfo[]> {
    const response = await this.request<OpenAICompatModelsResponse>('/v1/models');
    
    return response.data.map(m => ({
      id: m.id,
      name: this.formatModelName(m.id),
      provider: this.config.id,
      contextWindow: this.getContextWindow(m.id),
      capabilities: this.getModelCapabilities(m.id),
    }));
  }
  
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const compatRequest = this.toCompatRequest(request);
    
    const response = await this.request<OpenAICompatResponse>('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify(compatRequest),
    });
    
    return this.fromCompatResponse(response);
  }
  
  async *chatStream(request: ChatRequest): AsyncIterable<ChatStreamChunk> {
    const compatRequest = this.toCompatRequest({ ...request, stream: true });
    
    const stream = this.requestStream('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify(compatRequest),
    });
    
    let id = '';
    let model = '';
    
    for await (const { data } of parseSSE(stream)) {
      if (data === '[DONE]') break;
      
      try {
        const chunk: OpenAICompatStreamChunk = JSON.parse(data);
        
        if (!id && chunk.id) {
          id = chunk.id;
          model = chunk.model;
          yield { type: 'start', id, model };
        }
        
        const choice = chunk.choices[0];
        if (choice?.delta?.content) {
          yield { type: 'delta', content: choice.delta.content };
        }
        
        if (choice?.finish_reason) {
          yield { 
            type: 'done', 
            finishReason: this.mapFinishReason(choice.finish_reason) 
          };
        }
        
        if (chunk.usage) {
          yield {
            type: 'usage',
            usage: {
              inputTokens: chunk.usage.prompt_tokens,
              outputTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            },
          };
        }
      } catch {
        // Skip malformed events
      }
    }
  }
  
  // ---------------------------------------------------------------------------
  // Conversion Helpers
  // ---------------------------------------------------------------------------
  
  protected toCompatRequest(request: ChatRequest): OpenAICompatRequest {
    const messages = this.convertMessages(request);
    
    return {
      model: request.model,
      messages,
      max_tokens: request.maxTokens ?? this.compatOptions.defaultMaxTokens,
      temperature: request.temperature,
      top_p: request.topP,
      stop: request.stopSequences,
      stream: request.stream,
    };
  }
  
  protected convertMessages(request: ChatRequest): OpenAICompatMessage[] {
    const messages: OpenAICompatMessage[] = [];
    
    if (request.system) {
      messages.push({ role: 'system', content: request.system });
    }
    
    for (const msg of request.messages) {
      messages.push({
        role: msg.role,
        content: this.convertContent(msg.content),
      });
    }
    
    return messages;
  }
  
  protected convertContent(content: string | ContentPart[]): string | OpenAICompatContent[] {
    if (typeof content === 'string') {
      return content;
    }
    
    return content.map(part => {
      if (part.type === 'text') {
        return { type: 'text' as const, text: part.text };
      }
      
      if (part.type === 'image') {
        const url = part.source.type === 'base64'
          ? `data:${part.source.mediaType};base64,${part.source.data}`
          : part.source.url;
        
        return { type: 'image_url' as const, image_url: { url } };
      }
      
      throw new Error(`Unsupported content type: ${(part as ContentPart).type}`);
    });
  }
  
  protected fromCompatResponse(response: OpenAICompatResponse): ChatResponse {
    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No choices in response');
    }

    return {
      id: response.id,
      model: response.model,
      content: choice.message.content,
      finishReason: this.mapFinishReason(choice.finish_reason),
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      raw: response,
    };
  }
  
  protected mapFinishReason(reason: string): FinishReason {
    switch (reason) {
      case 'stop': return 'stop';
      case 'length': return 'length';
      case 'tool_calls': return 'tool_use';
      case 'content_filter': return 'content_filter';
      default: return 'unknown';
    }
  }
  
  // Override in subclasses for provider-specific formatting
  protected formatModelName(id: string): string {
    return id;
  }
  
  // Override in subclasses for provider-specific context windows
  protected getContextWindow(_id: string): number {
    return 4096;
  }
  
  // Override in subclasses for provider-specific capabilities
  protected getModelCapabilities(_id: string): Partial<ProviderCapabilities> {
    return {};
  }
}
