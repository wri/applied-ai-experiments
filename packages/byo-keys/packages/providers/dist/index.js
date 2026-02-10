import {
  AnthropicProvider,
  anthropic
} from "./chunk-RQBKIMCS.js";
import {
  OllamaProvider,
  ollama
} from "./chunk-2DU5YRF2.js";
import {
  OpenAIProvider,
  openai
} from "./chunk-R6CNNYAC.js";

// src/index.ts
import { BaseProvider as BaseProvider3, parseSSE as parseSSE3 } from "@byok-llm/core";

// src/openai-compat.ts
import { BaseProvider, parseSSE } from "@byok-llm/core";
var OpenAICompatProvider = class extends BaseProvider {
  compatOptions;
  constructor(options = {}) {
    super(options);
    this.compatOptions = {
      defaultMaxTokens: 4096,
      ...options
    };
  }
  addAuthHeaders(headers) {
    headers.set("Authorization", `Bearer ${this.getApiKey()}`);
  }
  async validateKey(key) {
    const originalKey = this.apiKey;
    this.apiKey = key;
    try {
      const models = await this.listModels();
      return {
        valid: true,
        providerId: this.config.id,
        models
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const isAuthError = message.includes("401") || message.includes("invalid") || message.includes("unauthorized");
      return {
        valid: false,
        providerId: this.config.id,
        error: message,
        errorCode: isAuthError ? "invalid_key" : "provider_error"
      };
    } finally {
      this.apiKey = originalKey;
    }
  }
  async listModels() {
    const response = await this.request("/v1/models");
    return response.data.map((m) => ({
      id: m.id,
      name: this.formatModelName(m.id),
      provider: this.config.id,
      contextWindow: this.getContextWindow(m.id),
      capabilities: this.getModelCapabilities(m.id)
    }));
  }
  async chat(request) {
    const compatRequest = this.toCompatRequest(request);
    const response = await this.request("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify(compatRequest)
    });
    return this.fromCompatResponse(response);
  }
  async *chatStream(request) {
    const compatRequest = this.toCompatRequest({ ...request, stream: true });
    const stream = this.requestStream("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify(compatRequest)
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
  // ---------------------------------------------------------------------------
  // Conversion Helpers
  // ---------------------------------------------------------------------------
  toCompatRequest(request) {
    const messages = this.convertMessages(request);
    return {
      model: request.model,
      messages,
      max_tokens: request.maxTokens ?? this.compatOptions.defaultMaxTokens,
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
        return { type: "image_url", image_url: { url } };
      }
      throw new Error(`Unsupported content type: ${part.type}`);
    });
  }
  fromCompatResponse(response) {
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
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0
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
  // Override in subclasses for provider-specific formatting
  formatModelName(id) {
    return id;
  }
  // Override in subclasses for provider-specific context windows
  getContextWindow(_id) {
    return 4096;
  }
  // Override in subclasses for provider-specific capabilities
  getModelCapabilities(_id) {
    return {};
  }
};

// src/gemini.ts
import { BaseProvider as BaseProvider2, parseSSE as parseSSE2 } from "@byok-llm/core";
var GeminiProvider = class extends BaseProvider2 {
  config = {
    id: "gemini",
    name: "Google Gemini",
    requiresKey: true,
    supportsCORS: true,
    // Gemini supports browser requests
    baseUrl: "https://generativelanguage.googleapis.com"
  };
  capabilities = {
    chat: true,
    streaming: true,
    embeddings: true,
    images: false,
    audio: true,
    vision: true,
    functionCalling: true,
    extendedThinking: true
  };
  geminiOptions;
  constructor(options = {}) {
    super(options);
    this.geminiOptions = {
      defaultMaxTokens: 8192,
      ...options
    };
  }
  /**
   * Gemini uses API key as query parameter, not header
   */
  addAuthHeaders(_headers) {
  }
  getAuthenticatedUrl(endpoint) {
    const baseUrl = this.getBaseUrl();
    const separator = endpoint.includes("?") ? "&" : "?";
    return `${baseUrl}${endpoint}${separator}key=${this.getApiKey()}`;
  }
  async validateKey(key) {
    const originalKey = this.apiKey;
    this.apiKey = key;
    try {
      const models = await this.listModels();
      return {
        valid: true,
        providerId: "gemini",
        models
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const isAuthError = message.includes("API_KEY_INVALID") || message.includes("401") || message.includes("403");
      return {
        valid: false,
        providerId: "gemini",
        error: message,
        errorCode: isAuthError ? "invalid_key" : "provider_error"
      };
    } finally {
      this.apiKey = originalKey;
    }
  }
  async listModels() {
    const url = this.getAuthenticatedUrl("/v1beta/models");
    const response = await this.fetchFn(url);
    if (!response.ok) {
      const error = await this.parseError(response);
      throw error;
    }
    const data = await response.json();
    const chatModels = data.models.filter((m) => m.supportedGenerationMethods.includes("generateContent")).map((m) => ({
      id: m.name.replace("models/", ""),
      name: m.displayName,
      provider: "gemini",
      contextWindow: m.inputTokenLimit,
      capabilities: {
        vision: m.name.includes("vision") || m.name.includes("1.5") || m.name.includes("2"),
        functionCalling: true
      }
    }));
    return chatModels.sort((a, b) => {
      const order = ["gemini-2", "gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0", "gemini-pro"];
      const aIndex = order.findIndex((p) => a.id.includes(p));
      const bIndex = order.findIndex((p) => b.id.includes(p));
      return aIndex - bIndex;
    });
  }
  async chat(request) {
    const model = request.model;
    const geminiRequest = this.toGeminiRequest(request);
    const url = this.getAuthenticatedUrl(`/v1beta/models/${model}:generateContent`);
    const response = await this.fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiRequest)
    });
    if (!response.ok) {
      const error = await this.parseError(response);
      throw error;
    }
    const data = await response.json();
    return this.fromGeminiResponse(data, model);
  }
  async *chatStream(request) {
    const model = request.model;
    const geminiRequest = this.toGeminiRequest(request);
    const url = this.getAuthenticatedUrl(`/v1beta/models/${model}:streamGenerateContent?alt=sse`);
    const response = await this.fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiRequest)
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
    let started = false;
    async function* streamToIterable() {
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
    for await (const { data } of parseSSE2(streamToIterable())) {
      try {
        const chunk = JSON.parse(data);
        if (!started) {
          started = true;
          yield { type: "start", id: crypto.randomUUID(), model };
        }
        const candidate = chunk.candidates?.[0];
        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.text) {
              if (part.thought) {
                wasThinking = true;
                yield { type: "thinking_delta", thinking: part.text };
              } else {
                if (wasThinking) {
                  wasThinking = false;
                  yield { type: "thinking_complete" };
                }
                yield { type: "delta", content: part.text };
              }
            }
          }
        }
        if (candidate?.finishReason) {
          if (wasThinking) {
            yield { type: "thinking_complete" };
          }
          yield {
            type: "done",
            finishReason: this.mapFinishReason(candidate.finishReason)
          };
        }
        if (chunk.usageMetadata) {
          yield {
            type: "usage",
            usage: {
              inputTokens: chunk.usageMetadata.promptTokenCount,
              outputTokens: chunk.usageMetadata.candidatesTokenCount,
              totalTokens: chunk.usageMetadata.totalTokenCount,
              thinkingTokens: chunk.usageMetadata.thoughtsTokenCount
            }
          };
        }
      } catch {
      }
    }
  }
  // ---------------------------------------------------------------------------
  // Conversion Helpers
  // ---------------------------------------------------------------------------
  toGeminiRequest(request) {
    const contents = this.convertMessages(request);
    const geminiRequest = {
      contents,
      generationConfig: {
        maxOutputTokens: request.maxTokens ?? this.geminiOptions.defaultMaxTokens,
        temperature: request.temperature,
        topP: request.topP,
        stopSequences: request.stopSequences
      }
    };
    if (request.thinking?.enabled && this.supportsThinking(request.model)) {
      geminiRequest.generationConfig.thinkingConfig = {
        includeThoughts: true,
        thinkingBudget: request.thinking.budgetTokens ?? 8192
      };
    }
    if (request.system) {
      geminiRequest.systemInstruction = {
        parts: [{ text: request.system }]
      };
    }
    return geminiRequest;
  }
  convertMessages(request) {
    const contents = [];
    for (const msg of request.messages) {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: this.convertContent(msg.content)
      });
    }
    return contents;
  }
  convertContent(content) {
    if (typeof content === "string") {
      return [{ text: content }];
    }
    return content.map((part) => {
      if (part.type === "text") {
        return { text: part.text };
      }
      if (part.type === "image") {
        if (part.source.type === "base64") {
          return {
            inlineData: {
              mimeType: part.source.mediaType,
              data: part.source.data
            }
          };
        }
        throw new Error("URL-based images not yet supported for Gemini - use base64");
      }
      throw new Error(`Unsupported content type: ${part.type}`);
    });
  }
  fromGeminiResponse(response, model) {
    const candidate = response.candidates[0];
    if (!candidate) {
      throw new Error("No candidates in response");
    }
    const textParts = candidate.content.parts.filter((p) => !p.thought);
    const thinkingParts = candidate.content.parts.filter((p) => p.thought);
    const content = textParts.map((p) => p.text).join("");
    const thinking = thinkingParts.length > 0 ? thinkingParts.map((p) => p.text).join("\n") : void 0;
    return {
      id: crypto.randomUUID(),
      model,
      content,
      finishReason: this.mapFinishReason(candidate.finishReason),
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
        thinkingTokens: response.usageMetadata?.thoughtsTokenCount
      },
      thinking,
      raw: response
    };
  }
  mapFinishReason(reason) {
    switch (reason) {
      case "STOP":
        return "stop";
      case "MAX_TOKENS":
        return "length";
      case "SAFETY":
        return "content_filter";
      case "RECITATION":
        return "content_filter";
      default:
        return "unknown";
    }
  }
  /**
   * Check if model supports thinking/reasoning
   */
  supportsThinking(model) {
    return model.includes("2.5") || model.includes("3.0") || model.includes("flash-thinking");
  }
};
function gemini(options) {
  return new GeminiProvider(options);
}

// src/mistral.ts
var MISTRAL_MODELS = {
  // Latest models
  "mistral-large-latest": { name: "Mistral Large", context: 128e3 },
  "mistral-medium-latest": { name: "Mistral Medium", context: 32768 },
  "mistral-small-latest": { name: "Mistral Small", context: 32768 },
  // Specific versions
  "mistral-large-2411": { name: "Mistral Large (Nov 2024)", context: 128e3 },
  "mistral-large-2407": { name: "Mistral Large (Jul 2024)", context: 128e3 },
  // Open models
  "open-mistral-nemo": { name: "Mistral Nemo (12B)", context: 128e3 },
  "open-mixtral-8x22b": { name: "Mixtral 8x22B", context: 65536 },
  "open-mixtral-8x7b": { name: "Mixtral 8x7B", context: 32768 },
  "open-mistral-7b": { name: "Mistral 7B", context: 32768 },
  // Specialized
  "codestral-latest": { name: "Codestral", context: 32768 },
  "codestral-mamba-latest": { name: "Codestral Mamba", context: 256e3 },
  "pixtral-large-latest": { name: "Pixtral Large (Vision)", context: 128e3 },
  "pixtral-12b-2409": { name: "Pixtral 12B (Vision)", context: 128e3 },
  // Embedding
  "mistral-embed": { name: "Mistral Embed", context: 8192 }
};
var MistralProvider = class extends OpenAICompatProvider {
  config = {
    id: "mistral",
    name: "Mistral AI",
    requiresKey: true,
    supportsCORS: false,
    // Mistral requires proxy for browser use
    baseUrl: "https://api.mistral.ai"
  };
  capabilities = {
    chat: true,
    streaming: true,
    embeddings: true,
    images: false,
    audio: false,
    vision: true,
    // Pixtral models
    functionCalling: true,
    extendedThinking: false
  };
  constructor(options = {}) {
    super({
      defaultMaxTokens: 4096,
      ...options
    });
  }
  formatModelName(id) {
    const known = MISTRAL_MODELS[id];
    return known?.name ?? id;
  }
  getContextWindow(id) {
    const known = MISTRAL_MODELS[id];
    if (known) return known.context;
    if (id.includes("large")) return 128e3;
    if (id.includes("8x22b")) return 65536;
    return 32768;
  }
  getModelCapabilities(id) {
    const isVision = id.includes("pixtral");
    const isEmbedding = id.includes("embed");
    const isCode = id.includes("codestral");
    return {
      vision: isVision,
      embeddings: isEmbedding,
      functionCalling: !isEmbedding && !isCode
    };
  }
};
function mistral(options) {
  return new MistralProvider(options);
}

// src/groq.ts
var GROQ_MODELS = {
  // Llama 3.3
  "llama-3.3-70b-versatile": { name: "Llama 3.3 70B Versatile", context: 128e3, vision: false },
  // Llama 3.2
  "llama-3.2-90b-vision-preview": { name: "Llama 3.2 90B Vision", context: 128e3, vision: true },
  "llama-3.2-11b-vision-preview": { name: "Llama 3.2 11B Vision", context: 128e3, vision: true },
  "llama-3.2-3b-preview": { name: "Llama 3.2 3B", context: 128e3, vision: false },
  "llama-3.2-1b-preview": { name: "Llama 3.2 1B", context: 128e3, vision: false },
  // Llama 3.1
  "llama-3.1-70b-versatile": { name: "Llama 3.1 70B Versatile", context: 128e3, vision: false },
  "llama-3.1-8b-instant": { name: "Llama 3.1 8B Instant", context: 128e3, vision: false },
  // Mixtral
  "mixtral-8x7b-32768": { name: "Mixtral 8x7B", context: 32768, vision: false },
  // Gemma
  "gemma2-9b-it": { name: "Gemma 2 9B", context: 8192, vision: false },
  // Tool Use
  "llama3-groq-70b-8192-tool-use-preview": { name: "Llama 3 70B Tool Use", context: 8192, vision: false },
  "llama3-groq-8b-8192-tool-use-preview": { name: "Llama 3 8B Tool Use", context: 8192, vision: false },
  // Whisper (speech)
  "whisper-large-v3": { name: "Whisper Large v3", context: 0, vision: false },
  "whisper-large-v3-turbo": { name: "Whisper Large v3 Turbo", context: 0, vision: false }
};
var GroqProvider = class extends OpenAICompatProvider {
  config = {
    id: "groq",
    name: "Groq",
    requiresKey: true,
    supportsCORS: false,
    // Groq requires proxy for browser use
    baseUrl: "https://api.groq.com/openai"
  };
  capabilities = {
    chat: true,
    streaming: true,
    embeddings: false,
    images: false,
    audio: true,
    // Whisper models
    vision: true,
    // Some models support vision
    functionCalling: true,
    extendedThinking: false
  };
  constructor(options = {}) {
    super({
      defaultMaxTokens: 8192,
      ...options
    });
  }
  formatModelName(id) {
    const known = GROQ_MODELS[id];
    return known?.name ?? id;
  }
  getContextWindow(id) {
    const known = GROQ_MODELS[id];
    if (known) return known.context;
    if (id.includes("32768")) return 32768;
    if (id.includes("8192")) return 8192;
    return 8192;
  }
  getModelCapabilities(id) {
    const known = GROQ_MODELS[id];
    return {
      vision: known?.vision ?? id.includes("vision"),
      functionCalling: id.includes("tool-use") || !id.includes("whisper") && !id.includes("vision"),
      audio: id.includes("whisper")
    };
  }
};
function groq(options) {
  return new GroqProvider(options);
}

// src/together.ts
var TogetherProvider = class extends OpenAICompatProvider {
  config = {
    id: "together",
    name: "Together AI",
    requiresKey: true,
    supportsCORS: false,
    // Together requires proxy for browser use
    baseUrl: "https://api.together.xyz"
  };
  capabilities = {
    chat: true,
    streaming: true,
    embeddings: true,
    images: true,
    // Image generation models
    audio: false,
    vision: true,
    // Some models support vision
    functionCalling: true,
    extendedThinking: false
  };
  constructor(options = {}) {
    super({
      defaultMaxTokens: 4096,
      ...options
    });
  }
  formatModelName(id) {
    const parts = id.split("/");
    const modelName = parts[1] ?? parts[0] ?? id;
    return modelName.replace(/-/g, " ");
  }
  getContextWindow(id) {
    const lowerModel = id.toLowerCase();
    if (lowerModel.includes("llama-3")) return 128e3;
    if (lowerModel.includes("mixtral-8x22b")) return 65536;
    if (lowerModel.includes("mixtral")) return 32768;
    if (lowerModel.includes("qwen")) return 32768;
    if (lowerModel.includes("deepseek")) return 64e3;
    if (lowerModel.includes("gemma")) return 8192;
    return 4096;
  }
  getModelCapabilities(id) {
    const lowerModel = id.toLowerCase();
    const hasVision = lowerModel.includes("vision") || lowerModel.includes("llava");
    const hasImageGen = lowerModel.includes("flux") || lowerModel.includes("stable-diffusion");
    return {
      vision: hasVision,
      images: hasImageGen,
      functionCalling: !hasImageGen && !lowerModel.includes("instruct")
    };
  }
};
function together(options) {
  return new TogetherProvider(options);
}

// src/openrouter.ts
var OpenRouterProvider = class extends OpenAICompatProvider {
  config = {
    id: "openrouter",
    name: "OpenRouter",
    requiresKey: true,
    supportsCORS: true,
    // OpenRouter supports browser requests
    baseUrl: "https://openrouter.ai/api"
  };
  capabilities = {
    chat: true,
    streaming: true,
    embeddings: false,
    images: false,
    audio: false,
    vision: true,
    // Some models support vision
    functionCalling: true,
    extendedThinking: false
  };
  openRouterOptions;
  constructor(options = {}) {
    super(options);
    this.openRouterOptions = options;
  }
  addAuthHeaders(headers) {
    super.addAuthHeaders(headers);
    if (this.openRouterOptions.siteUrl) {
      headers.set("HTTP-Referer", this.openRouterOptions.siteUrl);
    }
    if (this.openRouterOptions.siteName) {
      headers.set("X-Title", this.openRouterOptions.siteName);
    }
  }
  async listModels() {
    const response = await this.request("/v1/models");
    return response.data.map((m) => ({
      id: m.id,
      name: m.name,
      provider: "openrouter",
      contextWindow: m.context_length,
      capabilities: this.getModelCapabilities(m.id)
    }));
  }
  formatModelName(id) {
    const [provider, model] = id.split("/");
    return `${model} (${provider})`;
  }
  getContextWindow(id) {
    if (id.includes("claude-3")) return 2e5;
    if (id.includes("gpt-4")) return 128e3;
    if (id.includes("gemini")) return 1e6;
    if (id.includes("llama-3")) return 128e3;
    if (id.includes("mistral")) return 32768;
    return 4096;
  }
  getModelCapabilities(id) {
    const hasVision = id.includes("vision") || id.includes("claude-3") || id.includes("gpt-4o") || id.includes("gemini");
    return {
      vision: hasVision,
      functionCalling: !id.includes("instruct")
    };
  }
};
function openrouter(options) {
  return new OpenRouterProvider(options);
}

// src/index.ts
var PROVIDER_METADATA = {
  anthropic: {
    name: "Anthropic",
    description: "Claude models with advanced reasoning",
    supportsCORS: false,
    requiresKey: true,
    keyPlaceholder: "sk-ant-...",
    docsUrl: "https://docs.anthropic.com/"
  },
  openai: {
    name: "OpenAI",
    description: "GPT and o-series models",
    supportsCORS: false,
    requiresKey: true,
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.openai.com/docs/"
  },
  gemini: {
    name: "Google Gemini",
    description: "Gemini models with native CORS support",
    supportsCORS: true,
    requiresKey: true,
    keyPlaceholder: "AI...",
    docsUrl: "https://ai.google.dev/docs"
  },
  mistral: {
    name: "Mistral AI",
    description: "Efficient European-built models",
    supportsCORS: false,
    requiresKey: true,
    keyPlaceholder: "...",
    docsUrl: "https://docs.mistral.ai/"
  },
  groq: {
    name: "Groq",
    description: "Ultra-fast inference on LPU hardware",
    supportsCORS: false,
    requiresKey: true,
    keyPlaceholder: "gsk_...",
    docsUrl: "https://console.groq.com/docs/"
  },
  together: {
    name: "Together AI",
    description: "Open-source models at competitive prices",
    supportsCORS: false,
    requiresKey: true,
    keyPlaceholder: "...",
    docsUrl: "https://docs.together.ai/"
  },
  openrouter: {
    name: "OpenRouter",
    description: "Access 100+ models with native CORS support",
    supportsCORS: true,
    requiresKey: true,
    keyPlaceholder: "sk-or-...",
    docsUrl: "https://openrouter.ai/docs"
  },
  ollama: {
    name: "Ollama",
    description: "Run models locally on your machine",
    supportsCORS: true,
    requiresKey: false,
    keyPlaceholder: "",
    docsUrl: "https://ollama.ai/"
  }
};
export {
  AnthropicProvider,
  BaseProvider3 as BaseProvider,
  GeminiProvider,
  GroqProvider,
  MistralProvider,
  OllamaProvider,
  OpenAICompatProvider,
  OpenAIProvider,
  OpenRouterProvider,
  PROVIDER_METADATA,
  TogetherProvider,
  anthropic,
  gemini,
  groq,
  mistral,
  ollama,
  openai,
  openrouter,
  parseSSE3 as parseSSE,
  together
};
