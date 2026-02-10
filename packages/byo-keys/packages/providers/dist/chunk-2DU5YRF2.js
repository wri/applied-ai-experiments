// src/ollama.ts
import { BaseProvider } from "@byok-llm/core";
var OllamaProvider = class extends BaseProvider {
  config;
  capabilities = {
    chat: true,
    streaming: true,
    embeddings: true,
    images: false,
    audio: false,
    vision: true,
    // Many Ollama models support vision
    functionCalling: false,
    extendedThinking: false
  };
  constructor(options = {}) {
    super(options);
    this.config = {
      id: "ollama",
      name: "Ollama (Local)",
      requiresKey: false,
      // Ollama doesn't require API keys
      supportsCORS: true,
      // Local server, CORS configurable
      baseUrl: options.baseUrl ?? "http://localhost:11434"
    };
  }
  // Override to not require auth headers
  addAuthHeaders(_headers) {
  }
  // Override initialize since no key is needed
  initialize(_key) {
  }
  isInitialized() {
    return true;
  }
  getApiKey() {
    return "";
  }
  async validateKey(_key) {
    try {
      const models = await this.listModels();
      return {
        valid: true,
        providerId: "ollama",
        models
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        valid: false,
        providerId: "ollama",
        error: `Cannot connect to Ollama server: ${message}`,
        errorCode: "network_error"
      };
    }
  }
  /**
   * Check if Ollama server is running and reachable
   */
  async checkConnection() {
    try {
      await this.listModels();
      return true;
    } catch {
      return false;
    }
  }
  async listModels() {
    const response = await this.request("/api/tags");
    return response.models.map((m) => ({
      id: m.name,
      name: this.formatModelName(m.name),
      provider: "ollama",
      contextWindow: this.estimateContextWindow(m.details?.parameter_size),
      capabilities: {
        vision: this.supportsVision(m.name)
      }
    }));
  }
  async chat(request) {
    const ollamaRequest = this.toOllamaRequest({ ...request, stream: false });
    const response = await this.request("/api/chat", {
      method: "POST",
      body: JSON.stringify(ollamaRequest)
    });
    return this.fromOllamaResponse(response, request.model);
  }
  async *chatStream(request) {
    const ollamaRequest = this.toOllamaRequest({ ...request, stream: true });
    const url = `${this.getBaseUrl()}/api/chat`;
    const response = await this.fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ollamaRequest)
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    if (!response.body) {
      throw new Error("No response body");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let started = false;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line);
            if (!started) {
              started = true;
              yield {
                type: "start",
                id: `ollama-${Date.now()}`,
                model: chunk.model
              };
            }
            if (chunk.message?.content) {
              yield { type: "delta", content: chunk.message.content };
            }
            if (chunk.done) {
              yield { type: "done", finishReason: "stop" };
              if (chunk.eval_count !== void 0) {
                yield {
                  type: "usage",
                  usage: {
                    inputTokens: chunk.prompt_eval_count ?? 0,
                    outputTokens: chunk.eval_count
                  }
                };
              }
            }
          } catch {
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
  async pullModel(modelName, onProgress) {
    const url = `${this.getBaseUrl()}/api/pull`;
    const response = await this.fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName })
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
        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const status = JSON.parse(line);
            onProgress?.(status.status);
          } catch {
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
  async deleteModel(modelName) {
    await this.request("/api/delete", {
      method: "DELETE",
      body: JSON.stringify({ name: modelName })
    });
  }
  // ---------------------------------------------------------------------------
  // Conversion Helpers
  // ---------------------------------------------------------------------------
  toOllamaRequest(request) {
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
        stop: request.stopSequences
      }
    };
  }
  convertMessages(request) {
    const messages = [];
    if (request.system) {
      messages.push({ role: "system", content: request.system });
    }
    for (const msg of request.messages) {
      const converted = {
        role: msg.role,
        content: ""
      };
      if (typeof msg.content === "string") {
        converted.content = msg.content;
      } else {
        const textParts = [];
        const images = [];
        for (const part of msg.content) {
          if (part.type === "text") {
            textParts.push(part.text);
          } else if (part.type === "image" && part.source.type === "base64") {
            images.push(part.source.data);
          }
        }
        converted.content = textParts.join("\n");
        if (images.length > 0) {
          converted.images = images;
        }
      }
      messages.push(converted);
    }
    return messages;
  }
  fromOllamaResponse(response, model) {
    return {
      id: `ollama-${Date.now()}`,
      model,
      content: response.message.content,
      finishReason: "stop",
      usage: {
        inputTokens: response.prompt_eval_count ?? 0,
        outputTokens: response.eval_count ?? 0,
        totalTokens: (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0)
      },
      raw: response
    };
  }
  formatModelName(name) {
    const [base, variant] = name.split(":");
    const formatted = (base ?? name).replace(/(\d+)/g, " $1 ").replace(/([a-z])([A-Z])/g, "$1 $2").trim().split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    return variant ? `${formatted} (${variant.toUpperCase()})` : formatted;
  }
  estimateContextWindow(paramSize) {
    if (!paramSize) return 4096;
    const size = parseFloat(paramSize);
    if (size >= 70) return 32768;
    if (size >= 30) return 16384;
    if (size >= 7) return 8192;
    return 4096;
  }
  supportsVision(name) {
    const visionModels = ["llava", "bakllava", "moondream", "cogvlm"];
    return visionModels.some((v) => name.toLowerCase().includes(v));
  }
};
function ollama(options) {
  return new OllamaProvider(options);
}

export {
  OllamaProvider,
  ollama
};
