import { BaseProvider, ProviderConfig, ProviderCapabilities, BaseProviderOptions, KeyValidationResult, ModelInfo, ChatRequest, ChatResponse, ChatStreamChunk } from '@byok-llm/core';

interface OllamaProviderOptions extends BaseProviderOptions {
    /**
     * Ollama server URL
     * @default 'http://localhost:11434'
     */
    baseUrl?: string;
}
declare class OllamaProvider extends BaseProvider {
    readonly config: ProviderConfig;
    readonly capabilities: ProviderCapabilities;
    constructor(options?: OllamaProviderOptions);
    protected addAuthHeaders(_headers: Headers): void;
    initialize(_key?: string): void;
    isInitialized(): boolean;
    protected getApiKey(): string;
    validateKey(_key: string): Promise<KeyValidationResult>;
    /**
     * Check if Ollama server is running and reachable
     */
    checkConnection(): Promise<boolean>;
    listModels(): Promise<ModelInfo[]>;
    chat(request: ChatRequest): Promise<ChatResponse>;
    chatStream(request: ChatRequest): AsyncIterable<ChatStreamChunk>;
    /**
     * Pull a model from the Ollama library
     */
    pullModel(modelName: string, onProgress?: (status: string) => void): Promise<void>;
    /**
     * Delete a local model
     */
    deleteModel(modelName: string): Promise<void>;
    private toOllamaRequest;
    private convertMessages;
    private fromOllamaResponse;
    private formatModelName;
    private estimateContextWindow;
    private supportsVision;
}
declare function ollama(options?: OllamaProviderOptions): OllamaProvider;

export { OllamaProvider, type OllamaProviderOptions, ollama };
