import { BaseProvider, ProviderConfig, ProviderCapabilities, BaseProviderOptions, KeyValidationResult, ModelInfo, ChatRequest, ChatResponse, ChatStreamChunk } from '@byo-keys/core';

interface OpenAIProviderOptions extends BaseProviderOptions {
    /** Organization ID */
    organization?: string;
    /** Default max tokens if not specified in request */
    defaultMaxTokens?: number;
}
declare class OpenAIProvider extends BaseProvider {
    readonly config: ProviderConfig;
    readonly capabilities: ProviderCapabilities;
    private openaiOptions;
    constructor(options?: OpenAIProviderOptions);
    protected addAuthHeaders(headers: Headers): void;
    validateKey(key: string): Promise<KeyValidationResult>;
    listModels(): Promise<ModelInfo[]>;
    chat(request: ChatRequest): Promise<ChatResponse>;
    private chatWithCompletions;
    private chatWithResponses;
    chatStream(request: ChatRequest): AsyncIterable<ChatStreamChunk>;
    private chatStreamWithCompletions;
    private chatStreamWithResponses;
    private toOpenAIRequest;
    private convertMessages;
    private convertContent;
    private fromOpenAIResponse;
    private mapFinishReason;
    private formatModelName;
    private getContextWindow;
    private getCapabilities;
    /**
     * Check if model is a reasoning model (o1, o3, o4-mini)
     */
    private isReasoningModel;
    /**
     * Convert to Responses API request format
     */
    private toResponsesRequest;
    /**
     * Convert from Responses API response format
     */
    private fromResponsesResponse;
}
declare function openai(options?: OpenAIProviderOptions): OpenAIProvider;

export { OpenAIProvider, type OpenAIProviderOptions, openai };
