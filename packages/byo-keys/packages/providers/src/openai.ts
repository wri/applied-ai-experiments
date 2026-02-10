// =============================================================================
// OpenAI Provider
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
  ContentPart,
  FinishReason,
} from '@byo-keys/core';

// -----------------------------------------------------------------------------
// OpenAI-specific Types
// -----------------------------------------------------------------------------

interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | OpenAIContent[];
}

type OpenAIContent = 
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string[];
  stream?: boolean;
  stream_options?: { include_usage: boolean };
}

interface OpenAIResponse {
  id: string;
  object: 'chat.completion';
  model: string;
  choices: Array<{
    index: number;
    message: { role: 'assistant'; content: string };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamChunk {
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

interface OpenAIModelsResponse {
  data: Array<{
    id: string;
    object: 'model';
    created: number;
    owned_by: string;
  }>;
}

// -----------------------------------------------------------------------------
// OpenAI Responses API Types (for reasoning models)
// -----------------------------------------------------------------------------

interface OpenAIResponsesRequest {
  model: string;
  input: string | OpenAIResponsesMessage[];
  reasoning?: {
    effort?: 'low' | 'medium' | 'high';
    summary?: 'auto' | 'concise' | 'detailed';
  };
  max_output_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string[];
  stream?: boolean;
}

interface OpenAIResponsesMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | OpenAIContent[];
}

interface OpenAIResponsesResponse {
  id: string;
  object: 'response';
  model: string;
  output: OpenAIResponsesOutput[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    output_tokens_details?: {
      reasoning_tokens?: number;
    };
  };
  status: 'completed' | 'failed' | 'in_progress' | 'incomplete';
}

interface OpenAIResponsesOutput {
  type: 'message' | 'reasoning';
  id: string;
  status: string;
  role?: 'assistant';
  content?: Array<{
    type: 'output_text' | 'refusal';
    text?: string;
    refusal?: string;
  }>;
  summary?: Array<{
    type: 'summary_text';
    text: string;
  }>;
}

interface OpenAIResponsesStreamEvent {
  type: string;
  // response.created, response.output_item.added, response.output_text.delta, etc.
  response?: OpenAIResponsesResponse;
  output_index?: number;
  item?: OpenAIResponsesOutput;
  content_index?: number;
  delta?: string;
}

// -----------------------------------------------------------------------------
// Provider Options
// -----------------------------------------------------------------------------

export interface OpenAIProviderOptions extends BaseProviderOptions {
  /** Organization ID */
  organization?: string;
  /** Default max tokens if not specified in request */
  defaultMaxTokens?: number;
}

// -----------------------------------------------------------------------------
// OpenAI Provider Implementation
// -----------------------------------------------------------------------------

export class OpenAIProvider extends BaseProvider {
  readonly config: ProviderConfig = {
    id: 'openai',
    name: 'OpenAI',
    requiresKey: true,
    supportsCORS: false,
    baseUrl: 'https://api.openai.com',
  };
  
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    streaming: true,
    embeddings: true,
    images: true,
    audio: true,
    vision: true,
    functionCalling: true,
    extendedThinking: true,
  };
  
  private openaiOptions: OpenAIProviderOptions;
  
  constructor(options: OpenAIProviderOptions = {}) {
    super(options);
    this.openaiOptions = {
      defaultMaxTokens: 4096,
      ...options,
    };
  }
  
  protected addAuthHeaders(headers: Headers): void {
    headers.set('Authorization', `Bearer ${this.getApiKey()}`);
    
    if (this.openaiOptions.organization) {
      headers.set('OpenAI-Organization', this.openaiOptions.organization);
    }
  }
  
  async validateKey(key: string): Promise<KeyValidationResult> {
    const originalKey = this.apiKey;
    this.apiKey = key;
    
    try {
      const models = await this.listModels();
      
      return {
        valid: true,
        providerId: 'openai',
        models,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const isAuthError = message.includes('401') || 
                          message.includes('invalid') ||
                          message.includes('Incorrect API key');
      
      return {
        valid: false,
        providerId: 'openai',
        error: message,
        errorCode: isAuthError ? 'invalid_key' : 'provider_error',
      };
    } finally {
      this.apiKey = originalKey;
    }
  }
  
  async listModels(): Promise<ModelInfo[]> {
    const response = await this.request<OpenAIModelsResponse>('/v1/models');
    
    // Filter to chat models and map to our format
    const chatModels = response.data
      .filter(m => m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('o3'))
      .map(m => ({
        id: m.id,
        name: this.formatModelName(m.id),
        provider: 'openai' as const,
        contextWindow: this.getContextWindow(m.id),
        capabilities: this.getCapabilities(m.id),
      }));
    
    // Sort by preference
    return chatModels.sort((a, b) => {
      const order = ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1', 'o3'];
      const aIndex = order.findIndex(p => a.id.includes(p));
      const bIndex = order.findIndex(p => b.id.includes(p));
      return aIndex - bIndex;
    });
  }
  
  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Route to Responses API for reasoning models with thinking enabled
    if (this.isReasoningModel(request.model) && request.thinking?.enabled) {
      return this.chatWithResponses(request);
    }
    return this.chatWithCompletions(request);
  }

  private async chatWithCompletions(request: ChatRequest): Promise<ChatResponse> {
    const openaiRequest = this.toOpenAIRequest(request);

    const response = await this.request<OpenAIResponse>('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify(openaiRequest),
    });

    return this.fromOpenAIResponse(response);
  }

  private async chatWithResponses(request: ChatRequest): Promise<ChatResponse> {
    const responsesRequest = this.toResponsesRequest(request);

    const response = await this.request<OpenAIResponsesResponse>('/v1/responses', {
      method: 'POST',
      body: JSON.stringify(responsesRequest),
    });

    return this.fromResponsesResponse(response);
  }
  
  async *chatStream(request: ChatRequest): AsyncIterable<ChatStreamChunk> {
    // Route to Responses API streaming for reasoning models with thinking enabled
    if (this.isReasoningModel(request.model) && request.thinking?.enabled) {
      yield* this.chatStreamWithResponses(request);
      return;
    }
    yield* this.chatStreamWithCompletions(request);
  }

  private async *chatStreamWithCompletions(request: ChatRequest): AsyncIterable<ChatStreamChunk> {
    const openaiRequest = this.toOpenAIRequest({ ...request, stream: true });

    const stream = this.requestStream('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        ...openaiRequest,
        stream_options: { include_usage: true },
      }),
    });

    let id = '';
    let model = '';

    for await (const { data } of parseSSE(stream)) {
      if (data === '[DONE]') break;

      try {
        const chunk: OpenAIStreamChunk = JSON.parse(data);

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

  private async *chatStreamWithResponses(request: ChatRequest): AsyncIterable<ChatStreamChunk> {
    const responsesRequest = this.toResponsesRequest({ ...request, stream: true });

    const stream = this.requestStream('/v1/responses', {
      method: 'POST',
      body: JSON.stringify(responsesRequest),
    });

    let id = '';
    let model = '';
    let hasThinking = false;

    for await (const { data } of parseSSE(stream)) {
      if (data === '[DONE]') break;

      try {
        const event: OpenAIResponsesStreamEvent = JSON.parse(data);

        switch (event.type) {
          case 'response.created':
            if (event.response) {
              id = event.response.id;
              model = event.response.model;
              yield { type: 'start', id, model };
            }
            break;

          case 'response.output_item.added':
            // Track when reasoning output starts
            if (event.item?.type === 'reasoning') {
              hasThinking = true;
            }
            break;

          case 'response.reasoning_summary_text.delta':
            // Reasoning summary delta
            if (event.delta) {
              yield { type: 'thinking_delta', thinking: event.delta };
            }
            break;

          case 'response.reasoning_summary_text.done':
          case 'response.reasoning_summary_part.done':
            // Reasoning summary complete
            if (hasThinking) {
              yield { type: 'thinking_complete' };
              hasThinking = false;
            }
            break;

          case 'response.output_text.delta':
            // Regular content delta
            if (event.delta) {
              yield { type: 'delta', content: event.delta };
            }
            break;

          case 'response.completed':
            if (event.response?.usage) {
              yield {
                type: 'usage',
                usage: {
                  inputTokens: event.response.usage.input_tokens,
                  outputTokens: event.response.usage.output_tokens,
                  totalTokens: event.response.usage.total_tokens,
                  thinkingTokens: event.response.usage.output_tokens_details?.reasoning_tokens,
                },
              };
            }
            yield {
              type: 'done',
              finishReason: event.response?.status === 'completed' ? 'stop' : 'error',
            };
            break;
        }
      } catch {
        // Skip malformed events
      }
    }
  }
  
  // ---------------------------------------------------------------------------
  // Conversion Helpers
  // ---------------------------------------------------------------------------
  
  private toOpenAIRequest(request: ChatRequest): OpenAIRequest {
    const messages = this.convertMessages(request);
    
    return {
      model: request.model,
      messages,
      max_tokens: request.maxTokens ?? this.openaiOptions.defaultMaxTokens,
      temperature: request.temperature,
      top_p: request.topP,
      stop: request.stopSequences,
      stream: request.stream,
    };
  }
  
  private convertMessages(request: ChatRequest): OpenAIMessage[] {
    const messages: OpenAIMessage[] = [];
    
    // Add system message if present
    if (request.system) {
      messages.push({ role: 'system', content: request.system });
    }
    
    // Convert each message
    for (const msg of request.messages) {
      messages.push({
        role: msg.role,
        content: this.convertContent(msg.content),
      });
    }
    
    return messages;
  }
  
  private convertContent(content: string | ContentPart[]): string | OpenAIContent[] {
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
        
        return {
          type: 'image_url' as const,
          image_url: { url },
        };
      }
      
      throw new Error(`Unsupported content type: ${(part as ContentPart).type}`);
    });
  }
  
  private fromOpenAIResponse(response: OpenAIResponse): ChatResponse {
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
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      },
      raw: response,
    };
  }
  
  private mapFinishReason(reason: string): FinishReason {
    switch (reason) {
      case 'stop': return 'stop';
      case 'length': return 'length';
      case 'tool_calls': return 'tool_use';
      case 'content_filter': return 'content_filter';
      default: return 'unknown';
    }
  }
  
  private formatModelName(id: string): string {
    return id
      .replace('gpt-', 'GPT-')
      .replace('-turbo', ' Turbo')
      .replace('-preview', ' Preview');
  }
  
  private getContextWindow(id: string): number {
    if (id.includes('gpt-4o')) return 128000;
    if (id.includes('gpt-4-turbo')) return 128000;
    if (id.includes('gpt-4-32k')) return 32768;
    if (id.includes('gpt-4')) return 8192;
    if (id.includes('gpt-3.5-turbo-16k')) return 16385;
    if (id.includes('gpt-3.5-turbo')) return 4096;
    if (id.includes('o1') || id.includes('o3')) return 200000;
    return 4096;
  }
  
  private getCapabilities(id: string): Partial<ProviderCapabilities> {
    const isVisionModel = id.includes('gpt-4o') || id.includes('gpt-4-vision');
    const isReasoningModel = this.isReasoningModel(id);
    return {
      vision: isVisionModel,
      functionCalling: !id.includes('o1'),
      extendedThinking: isReasoningModel,
    };
  }

  /**
   * Check if model is a reasoning model (o1, o3, o4-mini)
   */
  private isReasoningModel(model: string): boolean {
    return model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4');
  }

  /**
   * Convert to Responses API request format
   */
  private toResponsesRequest(request: ChatRequest): OpenAIResponsesRequest {
    const messages = this.convertMessages(request);

    const responsesRequest: OpenAIResponsesRequest = {
      model: request.model,
      input: messages as OpenAIResponsesMessage[],
      max_output_tokens: request.maxTokens ?? this.openaiOptions.defaultMaxTokens,
      temperature: request.temperature,
      top_p: request.topP,
      stop: request.stopSequences,
      stream: request.stream,
    };

    // Add reasoning configuration if thinking is enabled
    if (request.thinking?.enabled) {
      responsesRequest.reasoning = {
        effort: request.thinking.effort ?? 'medium',
        summary: request.thinking.summaryLevel ?? 'auto',
      };
    }

    return responsesRequest;
  }

  /**
   * Convert from Responses API response format
   */
  private fromResponsesResponse(response: OpenAIResponsesResponse): ChatResponse {
    // Extract message content and reasoning summary
    let content = '';
    let thinking: string | undefined;

    for (const output of response.output) {
      if (output.type === 'message' && output.content) {
        for (const item of output.content) {
          if (item.type === 'output_text' && item.text) {
            content += item.text;
          }
        }
      }
      if (output.type === 'reasoning' && output.summary) {
        thinking = output.summary.map(s => s.text).join('\n');
      }
    }

    return {
      id: response.id,
      model: response.model,
      content,
      finishReason: response.status === 'completed' ? 'stop' : 'error',
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.total_tokens,
        thinkingTokens: response.usage.output_tokens_details?.reasoning_tokens,
      },
      thinking,
      raw: response,
    };
  }
}

// -----------------------------------------------------------------------------
// Factory Function
// -----------------------------------------------------------------------------

export function openai(options?: OpenAIProviderOptions): OpenAIProvider {
  return new OpenAIProvider(options);
}
