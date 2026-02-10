// =============================================================================
// Anthropic Provider
// =============================================================================

import { BaseProvider, parseSSE, type BaseProviderOptions } from '@byo-keys/core';
import type {
  ProviderConfig,
  ProviderCapabilities,
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  KeyValidationResult,
  ModelInfo,
  Message,
  ContentPart,
  FinishReason,
} from '@byo-keys/core';

// -----------------------------------------------------------------------------
// Anthropic-specific Types
// -----------------------------------------------------------------------------

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContent[];
}

interface AnthropicContent {
  type: 'text' | 'image' | 'thinking';
  text?: string;
  thinking?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  system?: string;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
  thinking?: {
    type: 'enabled';
    budget_tokens: number;
  };
}

interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  content: Array<{ type: 'text'; text: string } | { type: 'thinking'; thinking: string }>;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

interface AnthropicStreamEvent {
  type: string;
  message?: AnthropicResponse;
  index?: number;
  content_block?: { type: 'text'; text: string } | { type: 'thinking'; thinking: string };
  delta?: { type: string; text?: string; thinking?: string; stop_reason?: string };
  usage?: { output_tokens: number };
}

// -----------------------------------------------------------------------------
// Provider Options
// -----------------------------------------------------------------------------

export interface AnthropicProviderOptions extends BaseProviderOptions {
  /** 
   * Enable direct browser access (bypasses CORS).
   * WARNING: Only use in controlled environments.
   */
  dangerouslyAllowBrowser?: boolean;
  /** Default max tokens if not specified in request */
  defaultMaxTokens?: number;
  /** Anthropic API version header */
  apiVersion?: string;
}

// -----------------------------------------------------------------------------
// Anthropic Provider Implementation
// -----------------------------------------------------------------------------

export class AnthropicProvider extends BaseProvider {
  readonly config: ProviderConfig = {
    id: 'anthropic',
    name: 'Anthropic',
    requiresKey: true,
    supportsCORS: false, // Requires proxy or dangerous header
    baseUrl: 'https://api.anthropic.com',
  };

  readonly capabilities: ProviderCapabilities = {
    chat: true,
    streaming: true,
    embeddings: false,
    images: false,
    audio: false,
    vision: true,
    functionCalling: true,
    extendedThinking: true,
  };

  private anthropicOptions: AnthropicProviderOptions;
  private currentBlockType: 'text' | 'thinking' | null = null;
  
  constructor(options: AnthropicProviderOptions = {}) {
    super(options);
    this.anthropicOptions = {
      defaultMaxTokens: 4096,
      apiVersion: '2023-06-01',
      ...options,
    };
  }
  
  protected addAuthHeaders(headers: Headers): void {
    headers.set('x-api-key', this.getApiKey());
    headers.set('anthropic-version', this.anthropicOptions.apiVersion!);
    
    if (this.anthropicOptions.dangerouslyAllowBrowser) {
      headers.set('anthropic-dangerous-direct-browser-access', 'true');
    }
  }
  
  async validateKey(key: string): Promise<KeyValidationResult> {
    const originalKey = this.apiKey;
    this.apiKey = key;
    
    try {
      // Use a minimal request to validate the key
      // Anthropic doesn't have a models endpoint, so we make a minimal completion
      await this.request<AnthropicResponse>('/v1/messages', {
        method: 'POST',
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });
      
      return {
        valid: true,
        providerId: 'anthropic',
        models: await this.listModels(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const isAuthError = message.includes('401') || 
                          message.includes('invalid') ||
                          message.includes('authentication');
      
      return {
        valid: false,
        providerId: 'anthropic',
        error: message,
        errorCode: isAuthError ? 'invalid_key' : 'provider_error',
      };
    } finally {
      this.apiKey = originalKey;
    }
  }
  
  async listModels(): Promise<ModelInfo[]> {
    // Anthropic doesn't have a models endpoint, return known models
    return [
      {
        id: 'claude-opus-4-20250514',
        name: 'Claude Opus 4',
        provider: 'anthropic',
        contextWindow: 200000,
        maxOutputTokens: 32000,
        capabilities: { vision: true, functionCalling: true },
      },
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        provider: 'anthropic',
        contextWindow: 200000,
        maxOutputTokens: 64000,
        capabilities: { vision: true, functionCalling: true },
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        capabilities: { vision: true, functionCalling: true },
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        provider: 'anthropic',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        capabilities: { vision: true, functionCalling: true },
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        contextWindow: 200000,
        maxOutputTokens: 4096,
        capabilities: { vision: true, functionCalling: true },
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        contextWindow: 200000,
        maxOutputTokens: 4096,
        capabilities: { vision: true, functionCalling: true },
      },
    ];
  }
  
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const anthropicRequest = this.toAnthropicRequest(request);
    
    const response = await this.request<AnthropicResponse>('/v1/messages', {
      method: 'POST',
      body: JSON.stringify(anthropicRequest),
    });
    
    return this.fromAnthropicResponse(response);
  }
  
  async *chatStream(request: ChatRequest): AsyncIterable<ChatStreamChunk> {
    const anthropicRequest = this.toAnthropicRequest({ ...request, stream: true });
    
    const stream = this.requestStream('/v1/messages', {
      method: 'POST',
      body: JSON.stringify(anthropicRequest),
    });
    
    for await (const { data } of parseSSE(stream)) {
      if (data === '[DONE]') break;
      
      try {
        const event: AnthropicStreamEvent = JSON.parse(data);
        const chunk = this.parseStreamEvent(event);
        if (chunk) yield chunk;
      } catch {
        // Skip malformed events
      }
    }
  }
  
  // ---------------------------------------------------------------------------
  // Conversion Helpers
  // ---------------------------------------------------------------------------
  
  private toAnthropicRequest(request: ChatRequest): AnthropicRequest {
    const messages = this.convertMessages(request.messages);

    const anthropicRequest: AnthropicRequest = {
      model: request.model,
      messages,
      max_tokens: request.maxTokens ?? this.anthropicOptions.defaultMaxTokens!,
      system: request.system,
      temperature: request.temperature,
      top_p: request.topP,
      top_k: request.topK,
      stop_sequences: request.stopSequences,
      stream: request.stream,
    };

    // Add thinking configuration if enabled
    if (request.thinking?.enabled) {
      anthropicRequest.thinking = {
        type: 'enabled',
        budget_tokens: request.thinking.budgetTokens ?? 10000,
      };
    }

    return anthropicRequest;
  }
  
  private convertMessages(messages: Message[]): AnthropicMessage[] {
    return messages
      .filter(m => m.role !== 'system') // System handled separately
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: this.convertContent(m.content),
      }));
  }
  
  private convertContent(content: string | ContentPart[]): string | AnthropicContent[] {
    if (typeof content === 'string') {
      return content;
    }
    
    return content.map(part => {
      if (part.type === 'text') {
        return { type: 'text' as const, text: part.text };
      }
      
      if (part.type === 'image' && part.source.type === 'base64') {
        return {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: part.source.mediaType,
            data: part.source.data,
          },
        };
      }
      
      throw new Error(`Unsupported content type: ${(part as ContentPart).type}`);
    });
  }
  
  private fromAnthropicResponse(response: AnthropicResponse): ChatResponse {
    // Separate text and thinking blocks
    const textBlocks = response.content.filter(c => c.type === 'text') as Array<{ type: 'text'; text: string }>;
    const thinkingBlocks = response.content.filter(c => c.type === 'thinking') as Array<{ type: 'thinking'; thinking: string }>;

    return {
      id: response.id,
      model: response.model,
      content: textBlocks.map(c => c.text).join(''),
      finishReason: this.mapStopReason(response.stop_reason),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens,
        cacheWriteTokens: response.usage.cache_creation_input_tokens,
      },
      thinking: thinkingBlocks.length > 0
        ? thinkingBlocks.map(c => c.thinking).join('\n')
        : undefined,
      raw: response,
    };
  }
  
  private mapStopReason(reason: string | null): FinishReason {
    switch (reason) {
      case 'end_turn': return 'stop';
      case 'max_tokens': return 'length';
      case 'stop_sequence': return 'stop';
      case 'tool_use': return 'tool_use';
      default: return 'unknown';
    }
  }
  
  private parseStreamEvent(event: AnthropicStreamEvent): ChatStreamChunk | null {
    switch (event.type) {
      case 'message_start':
        return event.message ? {
          type: 'start',
          id: event.message.id,
          model: event.message.model,
        } : null;

      case 'content_block_start':
        this.currentBlockType = event.content_block?.type as 'text' | 'thinking' ?? null;
        return null;

      case 'content_block_delta':
        // Handle thinking deltas
        if (event.delta?.type === 'thinking_delta' && event.delta.thinking) {
          return { type: 'thinking_delta', thinking: event.delta.thinking };
        }
        // Handle text deltas
        if (event.delta?.type === 'text_delta' && event.delta.text) {
          return { type: 'delta', content: event.delta.text };
        }
        return null;

      case 'content_block_stop':
        if (this.currentBlockType === 'thinking') {
          this.currentBlockType = null;
          return { type: 'thinking_complete' };
        }
        this.currentBlockType = null;
        return null;

      case 'message_delta':
        if (event.delta?.stop_reason) {
          return {
            type: 'done',
            finishReason: this.mapStopReason(event.delta.stop_reason),
          };
        }
        if (event.usage) {
          return {
            type: 'usage',
            usage: { outputTokens: event.usage.output_tokens },
          };
        }
        return null;

      default:
        return null;
    }
  }
}

// -----------------------------------------------------------------------------
// Factory Function
// -----------------------------------------------------------------------------

export function anthropic(options?: AnthropicProviderOptions): AnthropicProvider {
  return new AnthropicProvider(options);
}
