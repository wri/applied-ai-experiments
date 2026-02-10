// =============================================================================
// @byo-keys/core - Public API
// =============================================================================

// Types
export type {
  // Provider types
  ProviderId,
  ProviderConfig,
  ProviderCapabilities,
  ModelInfo,
  ModelFilter,
  ProviderModelConfig,
  LLMProvider,

  // Message types
  MessageRole,
  Message,
  TextContent,
  ImageContent,
  ContentPart,

  // Chat types
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  FinishReason,
  TokenUsage,

  // Tool types
  ToolDefinition,
  ToolChoice,

  // Storage types
  StoredKey,
  KeyMetadata,
  KeyValidationResult,
  KeyValidationErrorCode,
  RateLimitInfo,
  KeyStorage,
  StorageOptions,

  // Event types
  BYOKEvent,
  BYOKEventListener,
  Unsubscribe,

  // State types
  BYOKState,
  KeyStatus,

  // Client types
  BYOKClientConfig,
  BYOKClient,

  // Error types
  BYOKErrorCode,
} from './types';

export { BYOKError } from './types';

// Client
export { createBYOKClient, BYOKClientImpl } from './client';

// Storage
export { 
  createStorage, 
  LocalStorage, 
  MemoryStorage, 
  EncryptedStorage 
} from './storage';

// Provider utilities
export { BaseProvider, parseSSE, type BaseProviderOptions } from './provider';
export { EventEmitter } from './provider';
