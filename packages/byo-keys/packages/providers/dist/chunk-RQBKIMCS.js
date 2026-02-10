// src/anthropic.ts
import { BaseProvider, parseSSE } from "@byok-llm/core";
var AnthropicProvider = class extends BaseProvider {
  config = {
    id: "anthropic",
    name: "Anthropic",
    requiresKey: true,
    supportsCORS: false,
    // Requires proxy or dangerous header
    baseUrl: "https://api.anthropic.com"
  };
  capabilities = {
    chat: true,
    streaming: true,
    embeddings: false,
    images: false,
    audio: false,
    vision: true,
    functionCalling: true,
    extendedThinking: true
  };
  anthropicOptions;
  currentBlockType = null;
  constructor(options = {}) {
    super(options);
    this.anthropicOptions = {
      defaultMaxTokens: 4096,
      apiVersion: "2023-06-01",
      ...options
    };
  }
  addAuthHeaders(headers) {
    headers.set("x-api-key", this.getApiKey());
    headers.set("anthropic-version", this.anthropicOptions.apiVersion);
    if (this.anthropicOptions.dangerouslyAllowBrowser) {
      headers.set("anthropic-dangerous-direct-browser-access", "true");
    }
  }
  async validateKey(key) {
    const originalKey = this.apiKey;
    this.apiKey = key;
    try {
      await this.request("/v1/messages", {
        method: "POST",
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 1,
          messages: [{ role: "user", content: "Hi" }]
        })
      });
      return {
        valid: true,
        providerId: "anthropic",
        models: await this.listModels()
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const isAuthError = message.includes("401") || message.includes("invalid") || message.includes("authentication");
      return {
        valid: false,
        providerId: "anthropic",
        error: message,
        errorCode: isAuthError ? "invalid_key" : "provider_error"
      };
    } finally {
      this.apiKey = originalKey;
    }
  }
  async listModels() {
    return [
      {
        id: "claude-opus-4-20250514",
        name: "Claude Opus 4",
        provider: "anthropic",
        contextWindow: 2e5,
        maxOutputTokens: 32e3,
        capabilities: { vision: true, functionCalling: true }
      },
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        provider: "anthropic",
        contextWindow: 2e5,
        maxOutputTokens: 64e3,
        capabilities: { vision: true, functionCalling: true }
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        provider: "anthropic",
        contextWindow: 2e5,
        maxOutputTokens: 8192,
        capabilities: { vision: true, functionCalling: true }
      },
      {
        id: "claude-3-5-haiku-20241022",
        name: "Claude 3.5 Haiku",
        provider: "anthropic",
        contextWindow: 2e5,
        maxOutputTokens: 8192,
        capabilities: { vision: true, functionCalling: true }
      },
      {
        id: "claude-3-opus-20240229",
        name: "Claude 3 Opus",
        provider: "anthropic",
        contextWindow: 2e5,
        maxOutputTokens: 4096,
        capabilities: { vision: true, functionCalling: true }
      },
      {
        id: "claude-3-haiku-20240307",
        name: "Claude 3 Haiku",
        provider: "anthropic",
        contextWindow: 2e5,
        maxOutputTokens: 4096,
        capabilities: { vision: true, functionCalling: true }
      }
    ];
  }
  async chat(request) {
    const anthropicRequest = this.toAnthropicRequest(request);
    const response = await this.request("/v1/messages", {
      method: "POST",
      body: JSON.stringify(anthropicRequest)
    });
    return this.fromAnthropicResponse(response);
  }
  async *chatStream(request) {
    const anthropicRequest = this.toAnthropicRequest({ ...request, stream: true });
    const stream = this.requestStream("/v1/messages", {
      method: "POST",
      body: JSON.stringify(anthropicRequest)
    });
    for await (const { data } of parseSSE(stream)) {
      if (data === "[DONE]") break;
      try {
        const event = JSON.parse(data);
        const chunk = this.parseStreamEvent(event);
        if (chunk) yield chunk;
      } catch {
      }
    }
  }
  // ---------------------------------------------------------------------------
  // Conversion Helpers
  // ---------------------------------------------------------------------------
  toAnthropicRequest(request) {
    const messages = this.convertMessages(request.messages);
    const anthropicRequest = {
      model: request.model,
      messages,
      max_tokens: request.maxTokens ?? this.anthropicOptions.defaultMaxTokens,
      system: request.system,
      temperature: request.temperature,
      top_p: request.topP,
      top_k: request.topK,
      stop_sequences: request.stopSequences,
      stream: request.stream
    };
    if (request.thinking?.enabled) {
      anthropicRequest.thinking = {
        type: "enabled",
        budget_tokens: request.thinking.budgetTokens ?? 1e4
      };
    }
    return anthropicRequest;
  }
  convertMessages(messages) {
    return messages.filter((m) => m.role !== "system").map((m) => ({
      role: m.role,
      content: this.convertContent(m.content)
    }));
  }
  convertContent(content) {
    if (typeof content === "string") {
      return content;
    }
    return content.map((part) => {
      if (part.type === "text") {
        return { type: "text", text: part.text };
      }
      if (part.type === "image" && part.source.type === "base64") {
        return {
          type: "image",
          source: {
            type: "base64",
            media_type: part.source.mediaType,
            data: part.source.data
          }
        };
      }
      throw new Error(`Unsupported content type: ${part.type}`);
    });
  }
  fromAnthropicResponse(response) {
    const textBlocks = response.content.filter((c) => c.type === "text");
    const thinkingBlocks = response.content.filter((c) => c.type === "thinking");
    return {
      id: response.id,
      model: response.model,
      content: textBlocks.map((c) => c.text).join(""),
      finishReason: this.mapStopReason(response.stop_reason),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens,
        cacheWriteTokens: response.usage.cache_creation_input_tokens
      },
      thinking: thinkingBlocks.length > 0 ? thinkingBlocks.map((c) => c.thinking).join("\n") : void 0,
      raw: response
    };
  }
  mapStopReason(reason) {
    switch (reason) {
      case "end_turn":
        return "stop";
      case "max_tokens":
        return "length";
      case "stop_sequence":
        return "stop";
      case "tool_use":
        return "tool_use";
      default:
        return "unknown";
    }
  }
  parseStreamEvent(event) {
    switch (event.type) {
      case "message_start":
        return event.message ? {
          type: "start",
          id: event.message.id,
          model: event.message.model
        } : null;
      case "content_block_start":
        this.currentBlockType = event.content_block?.type ?? null;
        return null;
      case "content_block_delta":
        if (event.delta?.type === "thinking_delta" && event.delta.thinking) {
          return { type: "thinking_delta", thinking: event.delta.thinking };
        }
        if (event.delta?.type === "text_delta" && event.delta.text) {
          return { type: "delta", content: event.delta.text };
        }
        return null;
      case "content_block_stop":
        if (this.currentBlockType === "thinking") {
          this.currentBlockType = null;
          return { type: "thinking_complete" };
        }
        this.currentBlockType = null;
        return null;
      case "message_delta":
        if (event.delta?.stop_reason) {
          return {
            type: "done",
            finishReason: this.mapStopReason(event.delta.stop_reason)
          };
        }
        if (event.usage) {
          return {
            type: "usage",
            usage: { outputTokens: event.usage.output_tokens }
          };
        }
        return null;
      default:
        return null;
    }
  }
};
function anthropic(options) {
  return new AnthropicProvider(options);
}

export {
  AnthropicProvider,
  anthropic
};
