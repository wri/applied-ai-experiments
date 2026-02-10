// =============================================================================
// Google Gemini Provider
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
// Gemini-specific Types
// -----------------------------------------------------------------------------

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

type GeminiPart =
  | { text: string; thought?: boolean }
  | { inlineData: { mimeType: string; data: string } };

interface GeminiRequest {
  contents: GeminiContent[];
  systemInstruction?: { parts: Array<{ text: string }> };
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
    thinkingConfig?: {
      includeThoughts?: boolean;
      thinkingBudget?: number;
    };
  };
}

interface GeminiResponse {
  candidates: Array<{
    content: { role: 'model'; parts: Array<{ text: string; thought?: boolean }> };
    finishReason: 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'OTHER';
    safetyRatings?: Array<{ category: string; probability: string }>;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
    thoughtsTokenCount?: number;
  };
  modelVersion?: string;
}

interface GeminiStreamChunk {
  candidates?: Array<{
    content?: { role: 'model'; parts?: Array<{ text: string; thought?: boolean }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
    thoughtsTokenCount?: number;
  };
}

interface GeminiModelsResponse {
  models: Array<{
    name: string;
    displayName: string;
    description?: string;
    inputTokenLimit: number;
    outputTokenLimit: number;
    supportedGenerationMethods: string[];
  }>;
}

// -----------------------------------------------------------------------------
// Provider Options
// -----------------------------------------------------------------------------

export interface GeminiProviderOptions extends BaseProviderOptions {
  /** Default max tokens if not specified in request */
  defaultMaxTokens?: number;
  /** Safety settings threshold */
  safetyThreshold?: 'BLOCK_NONE' | 'BLOCK_LOW' | 'BLOCK_MEDIUM' | 'BLOCK_HIGH';
}

// -----------------------------------------------------------------------------
// Gemini Provider Implementation
// -----------------------------------------------------------------------------

export class GeminiProvider extends BaseProvider {
  readonly config: ProviderConfig = {
    id: 'gemini',
    name: 'Google Gemini',
    requiresKey: true,
    supportsCORS: true, // Gemini supports browser requests
    baseUrl: 'https://generativelanguage.googleapis.com',
  };
  
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    streaming: true,
    embeddings: true,
    images: false,
    audio: true,
    vision: true,
    functionCalling: true,
    extendedThinking: true,
  };
  
  private geminiOptions: GeminiProviderOptions;
  
  constructor(options: GeminiProviderOptions = {}) {
    super(options);
    this.geminiOptions = {
      defaultMaxTokens: 8192,
      ...options,
    };
  }
  
  /**
   * Gemini uses API key as query parameter, not header
   */
  protected addAuthHeaders(_headers: Headers): void {
    // Gemini doesn't use auth headers - key is in URL
  }
  
  protected getAuthenticatedUrl(endpoint: string): string {
    const baseUrl = this.getBaseUrl();
    const separator = endpoint.includes('?') ? '&' : '?';
    return `${baseUrl}${endpoint}${separator}key=${this.getApiKey()}`;
  }
  
  async validateKey(key: string): Promise<KeyValidationResult> {
    const originalKey = this.apiKey;
    this.apiKey = key;
    
    try {
      const models = await this.listModels();
      
      return {
        valid: true,
        providerId: 'gemini',
        models,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const isAuthError = message.includes('API_KEY_INVALID') || 
                          message.includes('401') ||
                          message.includes('403');
      
      return {
        valid: false,
        providerId: 'gemini',
        error: message,
        errorCode: isAuthError ? 'invalid_key' : 'provider_error',
      };
    } finally {
      this.apiKey = originalKey;
    }
  }
  
  async listModels(): Promise<ModelInfo[]> {
    const url = this.getAuthenticatedUrl('/v1beta/models');
    
    const response = await this.fetchFn(url);
    if (!response.ok) {
      const error = await this.parseError(response);
      throw error;
    }
    
    const data: GeminiModelsResponse = await response.json();
    
    // Filter to generative models
    const chatModels = data.models
      .filter(m => m.supportedGenerationMethods.includes('generateContent'))
      .map(m => ({
        id: m.name.replace('models/', ''),
        name: m.displayName,
        provider: 'gemini' as const,
        contextWindow: m.inputTokenLimit,
        capabilities: {
          vision: m.name.includes('vision') || m.name.includes('1.5') || m.name.includes('2'),
          functionCalling: true,
        },
      }));
    
    // Sort by preference (newer models first)
    return chatModels.sort((a, b) => {
      const order = ['gemini-2', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0', 'gemini-pro'];
      const aIndex = order.findIndex(p => a.id.includes(p));
      const bIndex = order.findIndex(p => b.id.includes(p));
      return aIndex - bIndex;
    });
  }
  
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const model = request.model;
    const geminiRequest = this.toGeminiRequest(request);
    
    const url = this.getAuthenticatedUrl(`/v1beta/models/${model}:generateContent`);
    
    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiRequest),
    });
    
    if (!response.ok) {
      const error = await this.parseError(response);
      throw error;
    }
    
    const data: GeminiResponse = await response.json();
    return this.fromGeminiResponse(data, model);
  }
  
  async *chatStream(request: ChatRequest): AsyncIterable<ChatStreamChunk> {
    const model = request.model;
    const geminiRequest = this.toGeminiRequest(request);
    
    const url = this.getAuthenticatedUrl(`/v1beta/models/${model}:streamGenerateContent?alt=sse`);
    
    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiRequest),
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
    
    let started = false;
    
    async function* streamToIterable(): AsyncIterable<string> {
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
    
    let wasThinking = false;

    for await (const { data } of parseSSE(streamToIterable())) {
      try {
        const chunk: GeminiStreamChunk = JSON.parse(data);

        if (!started) {
          started = true;
          yield { type: 'start', id: crypto.randomUUID(), model };
        }

        const candidate = chunk.candidates?.[0];
        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.text) {
              if (part.thought) {
                // This is thinking content
                wasThinking = true;
                yield { type: 'thinking_delta', thinking: part.text };
              } else {
                // If we were thinking and now we're not, emit thinking_complete
                if (wasThinking) {
                  wasThinking = false;
                  yield { type: 'thinking_complete' };
                }
                yield { type: 'delta', content: part.text };
              }
            }
          }
        }

        if (candidate?.finishReason) {
          // Emit thinking_complete if we ended while still thinking
          if (wasThinking) {
            yield { type: 'thinking_complete' };
          }
          yield {
            type: 'done',
            finishReason: this.mapFinishReason(candidate.finishReason)
          };
        }

        if (chunk.usageMetadata) {
          yield {
            type: 'usage',
            usage: {
              inputTokens: chunk.usageMetadata.promptTokenCount,
              outputTokens: chunk.usageMetadata.candidatesTokenCount,
              totalTokens: chunk.usageMetadata.totalTokenCount,
              thinkingTokens: chunk.usageMetadata.thoughtsTokenCount,
            },
          };
        }
      } catch {
        // Skip malformed chunks
      }
    }
  }
  
  // ---------------------------------------------------------------------------
  // Conversion Helpers
  // ---------------------------------------------------------------------------
  
  private toGeminiRequest(request: ChatRequest): GeminiRequest {
    const contents = this.convertMessages(request);

    const geminiRequest: GeminiRequest = {
      contents,
      generationConfig: {
        maxOutputTokens: request.maxTokens ?? this.geminiOptions.defaultMaxTokens,
        temperature: request.temperature,
        topP: request.topP,
        stopSequences: request.stopSequences,
      },
    };

    // Add thinking configuration if enabled and model supports it
    if (request.thinking?.enabled && this.supportsThinking(request.model)) {
      geminiRequest.generationConfig!.thinkingConfig = {
        includeThoughts: true,
        thinkingBudget: request.thinking.budgetTokens ?? 8192,
      };
    }

    // Add system instruction if present
    if (request.system) {
      geminiRequest.systemInstruction = {
        parts: [{ text: request.system }],
      };
    }

    return geminiRequest;
  }
  
  private convertMessages(request: ChatRequest): GeminiContent[] {
    const contents: GeminiContent[] = [];
    
    for (const msg of request.messages) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: this.convertContent(msg.content),
      });
    }
    
    return contents;
  }
  
  private convertContent(content: string | ContentPart[]): GeminiPart[] {
    if (typeof content === 'string') {
      return [{ text: content }];
    }
    
    return content.map(part => {
      if (part.type === 'text') {
        return { text: part.text };
      }
      
      if (part.type === 'image') {
        if (part.source.type === 'base64') {
          return {
            inlineData: {
              mimeType: part.source.mediaType,
              data: part.source.data,
            },
          };
        }
        // URL images need to be fetched and converted to base64
        throw new Error('URL-based images not yet supported for Gemini - use base64');
      }
      
      throw new Error(`Unsupported content type: ${(part as ContentPart).type}`);
    });
  }
  
  private fromGeminiResponse(response: GeminiResponse, model: string): ChatResponse {
    const candidate = response.candidates[0];
    if (!candidate) {
      throw new Error('No candidates in response');
    }

    // Separate text and thinking parts
    const textParts = candidate.content.parts.filter(p => !p.thought);
    const thinkingParts = candidate.content.parts.filter(p => p.thought);

    const content = textParts.map(p => p.text).join('');
    const thinking = thinkingParts.length > 0
      ? thinkingParts.map(p => p.text).join('\n')
      : undefined;

    return {
      id: crypto.randomUUID(),
      model,
      content,
      finishReason: this.mapFinishReason(candidate.finishReason),
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
        thinkingTokens: response.usageMetadata?.thoughtsTokenCount,
      },
      thinking,
      raw: response,
    };
  }
  
  private mapFinishReason(reason: string): FinishReason {
    switch (reason) {
      case 'STOP': return 'stop';
      case 'MAX_TOKENS': return 'length';
      case 'SAFETY': return 'content_filter';
      case 'RECITATION': return 'content_filter';
      default: return 'unknown';
    }
  }

  /**
   * Check if model supports thinking/reasoning
   */
  private supportsThinking(model: string): boolean {
    return model.includes('2.5') || model.includes('3.0') || model.includes('flash-thinking');
  }
}

// -----------------------------------------------------------------------------
// Factory Function
// -----------------------------------------------------------------------------

export function gemini(options?: GeminiProviderOptions): GeminiProvider {
  return new GeminiProvider(options);
}
