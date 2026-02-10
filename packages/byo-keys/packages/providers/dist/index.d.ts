import { BaseProvider, ProviderConfig, ProviderCapabilities, BaseProviderOptions, KeyValidationResult, ModelInfo, ChatRequest, ChatResponse, ChatStreamChunk, ContentPart, FinishReason } from '@byo-keys/core';
export { BaseProvider, BaseProviderOptions, parseSSE } from '@byo-keys/core';
export { AnthropicProvider, AnthropicProviderOptions, anthropic } from './anthropic.js';
export { OpenAIProvider, OpenAIProviderOptions, openai } from './openai.js';
export { OllamaProvider, OllamaProviderOptions, ollama } from './ollama.js';

interface OpenAICompatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string | OpenAICompatContent[];
}
type OpenAICompatContent = {
    type: 'text';
    text: string;
} | {
    type: 'image_url';
    image_url: {
        url: string;
    };
};
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
        message: {
            role: 'assistant';
            content: string;
        };
        finish_reason: string;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
interface OpenAICompatProviderOptions extends BaseProviderOptions {
    /** Default max tokens if not specified in request */
    defaultMaxTokens?: number;
}
declare abstract class OpenAICompatProvider extends BaseProvider {
    abstract readonly config: ProviderConfig;
    abstract readonly capabilities: ProviderCapabilities;
    protected compatOptions: OpenAICompatProviderOptions;
    constructor(options?: OpenAICompatProviderOptions);
    protected addAuthHeaders(headers: Headers): void;
    validateKey(key: string): Promise<KeyValidationResult>;
    listModels(): Promise<ModelInfo[]>;
    chat(request: ChatRequest): Promise<ChatResponse>;
    chatStream(request: ChatRequest): AsyncIterable<ChatStreamChunk>;
    protected toCompatRequest(request: ChatRequest): OpenAICompatRequest;
    protected convertMessages(request: ChatRequest): OpenAICompatMessage[];
    protected convertContent(content: string | ContentPart[]): string | OpenAICompatContent[];
    protected fromCompatResponse(response: OpenAICompatResponse): ChatResponse;
    protected mapFinishReason(reason: string): FinishReason;
    protected formatModelName(id: string): string;
    protected getContextWindow(_id: string): number;
    protected getModelCapabilities(_id: string): Partial<ProviderCapabilities>;
}

interface GeminiProviderOptions extends BaseProviderOptions {
    /** Default max tokens if not specified in request */
    defaultMaxTokens?: number;
    /** Safety settings threshold */
    safetyThreshold?: 'BLOCK_NONE' | 'BLOCK_LOW' | 'BLOCK_MEDIUM' | 'BLOCK_HIGH';
}
declare class GeminiProvider extends BaseProvider {
    readonly config: ProviderConfig;
    readonly capabilities: ProviderCapabilities;
    private geminiOptions;
    constructor(options?: GeminiProviderOptions);
    /**
     * Gemini uses API key as query parameter, not header
     */
    protected addAuthHeaders(_headers: Headers): void;
    protected getAuthenticatedUrl(endpoint: string): string;
    validateKey(key: string): Promise<KeyValidationResult>;
    listModels(): Promise<ModelInfo[]>;
    chat(request: ChatRequest): Promise<ChatResponse>;
    chatStream(request: ChatRequest): AsyncIterable<ChatStreamChunk>;
    private toGeminiRequest;
    private convertMessages;
    private convertContent;
    private fromGeminiResponse;
    private mapFinishReason;
    /**
     * Check if model supports thinking/reasoning
     */
    private supportsThinking;
}
declare function gemini(options?: GeminiProviderOptions): GeminiProvider;

interface MistralProviderOptions extends OpenAICompatProviderOptions {
}
declare class MistralProvider extends OpenAICompatProvider {
    readonly config: ProviderConfig;
    readonly capabilities: ProviderCapabilities;
    constructor(options?: MistralProviderOptions);
    protected formatModelName(id: string): string;
    protected getContextWindow(id: string): number;
    protected getModelCapabilities(id: string): Partial<ProviderCapabilities>;
}
declare function mistral(options?: MistralProviderOptions): MistralProvider;

interface GroqProviderOptions extends OpenAICompatProviderOptions {
}
declare class GroqProvider extends OpenAICompatProvider {
    readonly config: ProviderConfig;
    readonly capabilities: ProviderCapabilities;
    constructor(options?: GroqProviderOptions);
    protected formatModelName(id: string): string;
    protected getContextWindow(id: string): number;
    protected getModelCapabilities(id: string): Partial<ProviderCapabilities>;
}
declare function groq(options?: GroqProviderOptions): GroqProvider;

interface TogetherProviderOptions extends OpenAICompatProviderOptions {
}
declare class TogetherProvider extends OpenAICompatProvider {
    readonly config: ProviderConfig;
    readonly capabilities: ProviderCapabilities;
    constructor(options?: TogetherProviderOptions);
    protected formatModelName(id: string): string;
    protected getContextWindow(id: string): number;
    protected getModelCapabilities(id: string): Partial<ProviderCapabilities>;
}
declare function together(options?: TogetherProviderOptions): TogetherProvider;

interface OpenRouterProviderOptions extends OpenAICompatProviderOptions {
    /** Optional site URL for OpenRouter attribution */
    siteUrl?: string;
    /** Optional site name for OpenRouter attribution */
    siteName?: string;
}
declare class OpenRouterProvider extends OpenAICompatProvider {
    readonly config: ProviderConfig;
    readonly capabilities: ProviderCapabilities;
    private openRouterOptions;
    constructor(options?: OpenRouterProviderOptions);
    protected addAuthHeaders(headers: Headers): void;
    listModels(): Promise<ModelInfo[]>;
    protected formatModelName(id: string): string;
    protected getContextWindow(id: string): number;
    protected getModelCapabilities(id: string): Partial<ProviderCapabilities>;
}
declare function openrouter(options?: OpenRouterProviderOptions): OpenRouterProvider;

/**
 * Provider metadata for UI display and configuration
 */
declare const PROVIDER_METADATA: {
    readonly anthropic: {
        readonly name: "Anthropic";
        readonly description: "Claude models with advanced reasoning";
        readonly supportsCORS: false;
        readonly requiresKey: true;
        readonly keyPlaceholder: "sk-ant-...";
        readonly docsUrl: "https://docs.anthropic.com/";
    };
    readonly openai: {
        readonly name: "OpenAI";
        readonly description: "GPT and o-series models";
        readonly supportsCORS: false;
        readonly requiresKey: true;
        readonly keyPlaceholder: "sk-...";
        readonly docsUrl: "https://platform.openai.com/docs/";
    };
    readonly gemini: {
        readonly name: "Google Gemini";
        readonly description: "Gemini models with native CORS support";
        readonly supportsCORS: true;
        readonly requiresKey: true;
        readonly keyPlaceholder: "AI...";
        readonly docsUrl: "https://ai.google.dev/docs";
    };
    readonly mistral: {
        readonly name: "Mistral AI";
        readonly description: "Efficient European-built models";
        readonly supportsCORS: false;
        readonly requiresKey: true;
        readonly keyPlaceholder: "...";
        readonly docsUrl: "https://docs.mistral.ai/";
    };
    readonly groq: {
        readonly name: "Groq";
        readonly description: "Ultra-fast inference on LPU hardware";
        readonly supportsCORS: false;
        readonly requiresKey: true;
        readonly keyPlaceholder: "gsk_...";
        readonly docsUrl: "https://console.groq.com/docs/";
    };
    readonly together: {
        readonly name: "Together AI";
        readonly description: "Open-source models at competitive prices";
        readonly supportsCORS: false;
        readonly requiresKey: true;
        readonly keyPlaceholder: "...";
        readonly docsUrl: "https://docs.together.ai/";
    };
    readonly openrouter: {
        readonly name: "OpenRouter";
        readonly description: "Access 100+ models with native CORS support";
        readonly supportsCORS: true;
        readonly requiresKey: true;
        readonly keyPlaceholder: "sk-or-...";
        readonly docsUrl: "https://openrouter.ai/docs";
    };
    readonly ollama: {
        readonly name: "Ollama";
        readonly description: "Run models locally on your machine";
        readonly supportsCORS: true;
        readonly requiresKey: false;
        readonly keyPlaceholder: "";
        readonly docsUrl: "https://ollama.ai/";
    };
};
type ProviderType = keyof typeof PROVIDER_METADATA;

export { GeminiProvider, type GeminiProviderOptions, GroqProvider, type GroqProviderOptions, MistralProvider, type MistralProviderOptions, OpenAICompatProvider, type OpenAICompatProviderOptions, OpenRouterProvider, type OpenRouterProviderOptions, PROVIDER_METADATA, type ProviderType, TogetherProvider, type TogetherProviderOptions, gemini, groq, mistral, openrouter, together };
