import { BaseProviderOptions, BaseProvider, ProviderConfig, ProviderCapabilities, KeyValidationResult, ModelInfo, ChatRequest, ChatResponse, ChatStreamChunk } from '@byok-llm/core';

interface AnthropicProviderOptions extends BaseProviderOptions {
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
declare class AnthropicProvider extends BaseProvider {
    readonly config: ProviderConfig;
    readonly capabilities: ProviderCapabilities;
    private anthropicOptions;
    private currentBlockType;
    constructor(options?: AnthropicProviderOptions);
    protected addAuthHeaders(headers: Headers): void;
    validateKey(key: string): Promise<KeyValidationResult>;
    listModels(): Promise<ModelInfo[]>;
    chat(request: ChatRequest): Promise<ChatResponse>;
    chatStream(request: ChatRequest): AsyncIterable<ChatStreamChunk>;
    private toAnthropicRequest;
    private convertMessages;
    private convertContent;
    private fromAnthropicResponse;
    private mapStopReason;
    private parseStreamEvent;
}
declare function anthropic(options?: AnthropicProviderOptions): AnthropicProvider;

export { AnthropicProvider, type AnthropicProviderOptions, anthropic };
