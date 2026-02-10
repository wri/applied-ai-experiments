// src/openai.ts
import { BaseProvider, parseSSE } from "@byok-llm/core";
var OpenAIProvider = class extends BaseProvider {
  config = {
    id: "openai",
    name: "OpenAI",
    requiresKey: true,
    supportsCORS: false,
    baseUrl: "https://api.openai.com"
  };
  capabilities = {
    chat: true,
    streaming: true,
    embeddings: true,
    images: true,
    audio: true,
    vision: true,
    functionCalling: true,
    extendedThinking: true
  };
  openaiOptions;
  constructor(options = {}) {
    super(options);
    this.openaiOptions = {
      defaultMaxTokens: 4096,
      ...options
    };
  }
  addAuthHeaders(headers) {
    headers.set("Authorization", `Bearer ${this.getApiKey()}`);
    if (this.openaiOptions.organization) {
      headers.set("OpenAI-Organization", this.openaiOptions.organization);
    }
  }
  async validateKey(key) {
    const originalKey = this.apiKey;
    this.apiKey = key;
    try {
      const models = await this.listModels();
      return {
        valid: true,
        providerId: "openai",
        models
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const isAuthError = message.includes("401") || message.includes("invalid") || message.includes("Incorrect API key");
      return {
        valid: false,
        providerId: "openai",
        error: message,
        errorCode: isAuthError ? "invalid_key" : "provider_error"
      };
    } finally {
      this.apiKey = originalKey;
    }
  }
  async listModels() {
    const response = await this.request("/v1/models");
    const chatModels = response.data.filter((m) => m.id.includes("gpt") || m.id.includes("o1") || m.id.includes("o3")).map((m) => ({
      id: m.id,
      name: this.formatModelName(m.id),
      provider: "openai",
      contextWindow: this.getContextWindow(m.id),
      capabilities: this.getCapabilities(m.id)
    }));
    return chatModels.sort((a, b) => {
      const order = ["gpt-4o", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo", "o1", "o3"];
      const aIndex = order.findIndex((p) => a.id.includes(p));
      const bIndex = order.findIndex((p) => b.id.includes(p));
      return aIndex - bIndex;
    });
  }
  async chat(request) {
    if (this.isReasoningModel(request.model) && request.thinking?.enabled) {
      return this.chatWithResponses(request);
    }
    return this.chatWithCompletions(request);
  }
  async chatWithCompletions(request) {
    const openaiRequest = this.toOpenAIRequest(request);
    const response = await this.request("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify(openaiRequest)
    });
    return this.fromOpenAIResponse(response);
  }
  async chatWithResponses(request) {
    const responsesRequest = this.toResponsesRequest(request);
    const response = await this.request("/v1/responses", {
      method: "POST",
      body: JSON.stringify(responsesRequest)
    });
    return this.fromResponsesResponse(response);
  }
  async *chatStream(request) {
    if (this.isReasoningModel(request.model) && request.thinking?.enabled) {
      yield* this.chatStreamWithResponses(request);
      return;
    }
    yield* this.chatStreamWithCompletions(request);
  }
  async *chatStreamWithCompletions(request) {
    const openaiRequest = this.toOpenAIRequest({ ...request, stream: true });
    const stream = this.requestStream("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        ...openaiRequest,
        stream_options: { include_usage: true }
      })
    });
    let id = "";
    let model = "";
    for await (const { data } of parseSSE(stream)) {
      if (data === "[DONE]") break;
      try {
        const chunk = JSON.parse(data);
        if (!id && chunk.id) {
          id = chunk.id;
          model = chunk.model;
          yield { type: "start", id, model };
        }
        const choice = chunk.choices[0];
        if (choice?.delta?.content) {
          yield { type: "delta", content: choice.delta.content };
        }
        if (choice?.finish_reason) {
          yield {
            type: "done",
            finishReason: this.mapFinishReason(choice.finish_reason)
          };
        }
        if (chunk.usage) {
          yield {
            type: "usage",
            usage: {
              inputTokens: chunk.usage.prompt_tokens,
              outputTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens
            }
          };
        }
      } catch {
      }
    }
  }
  async *chatStreamWithResponses(request) {
    const responsesRequest = this.toResponsesRequest({ ...request, stream: true });
    const stream = this.requestStream("/v1/responses", {
      method: "POST",
      body: JSON.stringify(responsesRequest)
    });
    let id = "";
    let model = "";
    let hasThinking = false;
    for await (const { data } of parseSSE(stream)) {
      if (data === "[DONE]") break;
      try {
        const event = JSON.parse(data);
        switch (event.type) {
          case "response.created":
            if (event.response) {
              id = event.response.id;
              model = event.response.model;
              yield { type: "start", id, model };
            }
            break;
          case "response.output_item.added":
            if (event.item?.type === "reasoning") {
              hasThinking = true;
            }
            break;
          case "response.reasoning_summary_text.delta":
            if (event.delta) {
              yield { type: "thinking_delta", thinking: event.delta };
            }
            break;
          case "response.reasoning_summary_text.done":
          case "response.reasoning_summary_part.done":
            if (hasThinking) {
              yield { type: "thinking_complete" };
              hasThinking = false;
            }
            break;
          case "response.output_text.delta":
            if (event.delta) {
              yield { type: "delta", content: event.delta };
            }
            break;
          case "response.completed":
            if (event.response?.usage) {
              yield {
                type: "usage",
                usage: {
                  inputTokens: event.response.usage.input_tokens,
                  outputTokens: event.response.usage.output_tokens,
                  totalTokens: event.response.usage.total_tokens,
                  thinkingTokens: event.response.usage.output_tokens_details?.reasoning_tokens
                }
              };
            }
            yield {
              type: "done",
              finishReason: event.response?.status === "completed" ? "stop" : "error"
            };
            break;
        }
      } catch {
      }
    }
  }
  // ---------------------------------------------------------------------------
  // Conversion Helpers
  // ---------------------------------------------------------------------------
  toOpenAIRequest(request) {
    const messages = this.convertMessages(request);
    return {
      model: request.model,
      messages,
      max_tokens: request.maxTokens ?? this.openaiOptions.defaultMaxTokens,
      temperature: request.temperature,
      top_p: request.topP,
      stop: request.stopSequences,
      stream: request.stream
    };
  }
  convertMessages(request) {
    const messages = [];
    if (request.system) {
      messages.push({ role: "system", content: request.system });
    }
    for (const msg of request.messages) {
      messages.push({
        role: msg.role,
        content: this.convertContent(msg.content)
      });
    }
    return messages;
  }
  convertContent(content) {
    if (typeof content === "string") {
      return content;
    }
    return content.map((part) => {
      if (part.type === "text") {
        return { type: "text", text: part.text };
      }
      if (part.type === "image") {
        const url = part.source.type === "base64" ? `data:${part.source.mediaType};base64,${part.source.data}` : part.source.url;
        return {
          type: "image_url",
          image_url: { url }
        };
      }
      throw new Error(`Unsupported content type: ${part.type}`);
    });
  }
  fromOpenAIResponse(response) {
    const choice = response.choices[0];
    if (!choice) {
      throw new Error("No choices in response");
    }
    return {
      id: response.id,
      model: response.model,
      content: choice.message.content,
      finishReason: this.mapFinishReason(choice.finish_reason),
      usage: {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      },
      raw: response
    };
  }
  mapFinishReason(reason) {
    switch (reason) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      case "tool_calls":
        return "tool_use";
      case "content_filter":
        return "content_filter";
      default:
        return "unknown";
    }
  }
  formatModelName(id) {
    return id.replace("gpt-", "GPT-").replace("-turbo", " Turbo").replace("-preview", " Preview");
  }
  getContextWindow(id) {
    if (id.includes("gpt-4o")) return 128e3;
    if (id.includes("gpt-4-turbo")) return 128e3;
    if (id.includes("gpt-4-32k")) return 32768;
    if (id.includes("gpt-4")) return 8192;
    if (id.includes("gpt-3.5-turbo-16k")) return 16385;
    if (id.includes("gpt-3.5-turbo")) return 4096;
    if (id.includes("o1") || id.includes("o3")) return 2e5;
    return 4096;
  }
  getCapabilities(id) {
    const isVisionModel = id.includes("gpt-4o") || id.includes("gpt-4-vision");
    const isReasoningModel = this.isReasoningModel(id);
    return {
      vision: isVisionModel,
      functionCalling: !id.includes("o1"),
      extendedThinking: isReasoningModel
    };
  }
  /**
   * Check if model is a reasoning model (o1, o3, o4-mini)
   */
  isReasoningModel(model) {
    return model.startsWith("o1") || model.startsWith("o3") || model.startsWith("o4");
  }
  /**
   * Convert to Responses API request format
   */
  toResponsesRequest(request) {
    const messages = this.convertMessages(request);
    const responsesRequest = {
      model: request.model,
      input: messages,
      max_output_tokens: request.maxTokens ?? this.openaiOptions.defaultMaxTokens,
      temperature: request.temperature,
      top_p: request.topP,
      stop: request.stopSequences,
      stream: request.stream
    };
    if (request.thinking?.enabled) {
      responsesRequest.reasoning = {
        effort: request.thinking.effort ?? "medium",
        summary: request.thinking.summaryLevel ?? "auto"
      };
    }
    return responsesRequest;
  }
  /**
   * Convert from Responses API response format
   */
  fromResponsesResponse(response) {
    let content = "";
    let thinking;
    for (const output of response.output) {
      if (output.type === "message" && output.content) {
        for (const item of output.content) {
          if (item.type === "output_text" && item.text) {
            content += item.text;
          }
        }
      }
      if (output.type === "reasoning" && output.summary) {
        thinking = output.summary.map((s) => s.text).join("\n");
      }
    }
    return {
      id: response.id,
      model: response.model,
      content,
      finishReason: response.status === "completed" ? "stop" : "error",
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.total_tokens,
        thinkingTokens: response.usage.output_tokens_details?.reasoning_tokens
      },
      thinking,
      raw: response
    };
  }
};
function openai(options) {
  return new OpenAIProvider(options);
}

export {
  OpenAIProvider,
  openai
};
