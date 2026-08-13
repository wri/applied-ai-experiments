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
  thinking?:
    | { type: 'adaptive' }
    | { type: 'disabled' }
    | { type: 'enabled'; budget_tokens: number };
}

// -----------------------------------------------------------------------------
// Per-model request-shape rules
// -----------------------------------------------------------------------------
//
// The Claude 4.7+ generation removed request fields that older models accept.
// Sending them is a 400, not a warning, so the shape of the request has to be
// chosen from the model id. Rules (see the `claude-api` skill for the source):
//
//   • temperature / top_p / top_k — removed on Fable 5, Mythos 5, Opus 5,
//     Sonnet 5, Opus 4.8 and Opus 4.7. Still accepted on Opus 4.6, Sonnet 4.6
//     and everything older.
//   • thinking.budget_tokens — removed on the same set; deprecated (but
//     working) on the 4.6 pair; still the only way to think on Haiku 4.5 and
//     older.
//   • thinking: {type: 'adaptive'} — available from the 4.6 generation onward.
//   • Fable 5 / Mythos 5 think unconditionally and reject *any* explicit
//     thinking config, including {type: 'disabled'}.

/** Models that reject `temperature` / `top_p` / `top_k`. */
const NO_SAMPLING_PARAMS =
  /^claude-(?:fable|mythos)-5|^claude-opus-5|^claude-sonnet-5|^claude-opus-4-[78]/;

/** Models where thinking is always on and any explicit config is a 400. */
const THINKING_ALWAYS_ON = /^claude-(?:fable|mythos)-5/;

/** Models that take `thinking: {type: 'adaptive' | 'disabled'}`. */
const THINKING_ADAPTIVE =
  /^claude-(?:opus|sonnet)-5|^claude-opus-4-[678]|^claude-sonnet-4-6/;

type ThinkingStyle = 'always-on' | 'adaptive' | 'budget';

function thinkingStyleFor(model: string): ThinkingStyle {
  if (THINKING_ALWAYS_ON.test(model)) return 'always-on';
  if (THINKING_ADAPTIVE.test(model)) return 'adaptive';
  return 'budget';
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
          model: 'claude-haiku-4-5',
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
    // Anthropic has no public models endpoint on this key type, so this is a
    // hand-maintained list. The demos read @wri-datalab/llm-lab's registry
    // instead — keep this in step with it when models change.
    return [
      {
        id: 'claude-opus-5',
        name: 'Claude Opus 5',
        provider: 'anthropic',
        contextWindow: 1000000,
        maxOutputTokens: 128000,
        capabilities: { vision: true, functionCalling: true, extendedThinking: true },
      },
      {
        id: 'claude-sonnet-5',
        name: 'Claude Sonnet 5',
        provider: 'anthropic',
        contextWindow: 1000000,
        maxOutputTokens: 128000,
        capabilities: { vision: true, functionCalling: true, extendedThinking: true },
      },
      {
        id: 'claude-haiku-4-5',
        name: 'Claude Haiku 4.5',
        provider: 'anthropic',
        contextWindow: 200000,
        maxOutputTokens: 64000,
        capabilities: { vision: true, functionCalling: true, extendedThinking: true },
      },
      {
        id: 'claude-opus-4-8',
        name: 'Claude Opus 4.8',
        provider: 'anthropic',
        contextWindow: 1000000,
        maxOutputTokens: 128000,
        capabilities: { vision: true, functionCalling: true, extendedThinking: true },
      },
      {
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        provider: 'anthropic',
        contextWindow: 1000000,
        maxOutputTokens: 64000,
        capabilities: { vision: true, functionCalling: true, extendedThinking: true },
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
        const parsed = this.parseStreamEvent(event);
        if (!parsed) continue;
        if (Array.isArray(parsed)) {
          for (const chunk of parsed) yield chunk;
        } else {
          yield parsed;
        }
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
    const maxTokens = request.maxTokens ?? this.anthropicOptions.defaultMaxTokens!;

    const anthropicRequest: AnthropicRequest = {
      model: request.model,
      messages,
      max_tokens: maxTokens,
      system: request.system,
      stop_sequences: request.stopSequences,
      stream: request.stream,
    };

    // Sampling parameters are silently dropped (not an error) for models that
    // reject them — a demo's temperature control becomes inert rather than
    // failing the call.
    if (!NO_SAMPLING_PARAMS.test(request.model)) {
      anthropicRequest.temperature = request.temperature;
      anthropicRequest.top_p = request.topP;
      anthropicRequest.top_k = request.topK;
    }

    switch (thinkingStyleFor(request.model)) {
      case 'always-on':
        // Any `thinking` field is a 400 here; the model thinks regardless.
        break;
      case 'adaptive':
        // Explicit either way: on these models omitting `thinking` means
        // "adaptive" on Opus 5 / Sonnet 5 but "off" on 4.6–4.8, so state it.
        // Caveat for anyone adding `output_config.effort` later: Opus 5 only
        // accepts {type: 'disabled'} at effort `high` or below — pairing it
        // with `xhigh`/`max` is a 400.
        anthropicRequest.thinking = request.thinking?.enabled
          ? { type: 'adaptive' }
          : { type: 'disabled' };
        break;
      case 'budget':
        if (request.thinking?.enabled) {
          // budget_tokens must be ≥ 1024 and strictly less than max_tokens.
          const requested = request.thinking.budgetTokens ?? 10000;
          anthropicRequest.thinking = {
            type: 'enabled',
            budget_tokens: Math.max(1024, Math.min(requested, maxTokens - 1)),
          };
        }
        break;
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

  private parseStreamEvent(event: AnthropicStreamEvent): ChatStreamChunk | ChatStreamChunk[] | null {
    switch (event.type) {
      case 'message_start': {
        if (!event.message) return null;
        // Anthropic reports input + cache tokens only at message_start (the
        // later message_delta carries output tokens). Emit them as a usage
        // chunk so downstream telemetry sees full token-by-type usage.
        const usage = event.message.usage;
        return [
          { type: 'start', id: event.message.id, model: event.message.model },
          {
            type: 'usage',
            usage: {
              inputTokens: usage.input_tokens,
              cacheReadTokens: usage.cache_read_input_tokens,
              cacheWriteTokens: usage.cache_creation_input_tokens,
            },
          },
        ];
      }

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
