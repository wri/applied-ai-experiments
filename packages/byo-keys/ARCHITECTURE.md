# BYO-Keys: Bring Your Own Key for LLM Applications

## Overview

A framework-agnostic TypeScript package that simplifies the BYOK pattern for LLM-powered web applications. Users store their own API keys in browser storage, enabling direct-to-provider API calls without backend proxy requirements.

## Core Design Principles

1. **Provider Abstraction**: Unified interface across all LLM providers while preserving provider-specific capabilities
2. **Storage Agnosticism**: Pluggable storage backends with sensible defaults (localStorage with optional encryption)
3. **Validation Without Cost**: Key validation via minimal API calls (model listing, not completions)
4. **Event-Driven State**: Observable state changes for seamless UI integration
5. **Type Safety**: Full TypeScript coverage with discriminated unions and generics
6. **Zero Dependencies**: Core package has no runtime dependencies; adapters are optional

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Application                                │
├─────────────────────────────────────────────────────────────────────┤
│                     Framework Adapters (optional)                    │
│                   ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│                   │ Svelte   │ │  React   │ │   Vue    │            │
│                   │  Stores  │ │  Hooks   │ │ Composables│           │
│                   └──────────┘ └──────────┘ └──────────┘            │
├─────────────────────────────────────────────────────────────────────┤
│                          @byo-keys/core                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Client    │  │  Registry   │  │   Storage   │  │   Events    │ │
│  │ Orchestrator│◄─┤  Provider   │  │   Manager   │  │   Emitter   │ │
│  └──────┬──────┘  │  Registry   │  └──────┬──────┘  └──────┬──────┘ │
│         │         └─────────────┘         │                │        │
│         ▼                                 ▼                ▼        │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                      Provider Adapters                          ││
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐ ││
│  │ │Anthropic│ │ OpenAI  │ │ Gemini  │ │ Ollama  │ │ OpenRouter  │ ││
│  │ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────────┘ ││
│  │ ┌─────────┐ ┌─────────┐ ┌─────────────────────────────────────┐ ││
│  │ │ Groq    │ │Together │ │      Custom Provider Interface      │ ││
│  │ └─────────┘ └─────────┘ └─────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────┤
│                        Storage Backends                              │
│    ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐     │
│    │ localStorage │  │ Encrypted    │  │ Custom (IndexedDB,   │     │
│    │   (default)  │  │ localStorage │  │ sessionStorage, etc) │     │
│    └──────────────┘  └──────────────┘  └──────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Abstractions

### 1. Provider Interface

All providers implement a common interface with optional provider-specific extensions:

```typescript
interface LLMProvider {
  readonly id: string;
  readonly name: string;
  readonly requiresKey: boolean;
  readonly supportsCORS: boolean;
  
  // Key management
  validateKey(key: string): Promise<KeyValidationResult>;
  
  // Core capabilities
  chat(request: ChatRequest): Promise<ChatResponse>;
  chatStream(request: ChatRequest): AsyncIterable<ChatStreamChunk>;
  
  // Discovery
  listModels(): Promise<ModelInfo[]>;
  
  // Optional capabilities (type-guarded)
  embeddings?(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  images?(request: ImageRequest): Promise<ImageResponse>;
}
```

### 2. Storage Interface

Pluggable storage with encryption support:

```typescript
interface KeyStorage {
  get(providerId: string): Promise<StoredKey | null>;
  set(providerId: string, key: string, metadata?: KeyMetadata): Promise<void>;
  remove(providerId: string): Promise<void>;
  list(): Promise<StoredKey[]>;
  clear(): Promise<void>;
}
```

### 3. Client Orchestrator

The main entry point that ties everything together:

```typescript
interface BYOKClient {
  // Provider management
  readonly providers: ReadonlyMap<string, LLMProvider>;
  getProvider(id: string): LLMProvider | undefined;
  
  // Key management
  setKey(providerId: string, key: string): Promise<KeyValidationResult>;
  removeKey(providerId: string): Promise<void>;
  hasKey(providerId: string): boolean;
  
  // Unified API
  chat(providerId: string, request: ChatRequest): Promise<ChatResponse>;
  chatStream(providerId: string, request: ChatRequest): AsyncIterable<ChatStreamChunk>;
  
  // State observation
  subscribe(listener: StateListener): Unsubscribe;
  getState(): BYOKState;
}
```

## CORS Considerations

Browser-based API calls face CORS restrictions. This package handles them via:

| Provider | CORS Support | Strategy |
|----------|--------------|----------|
| Anthropic | ❌ | Requires proxy OR uses `anthropic-dangerous-direct-browser-access` header |
| OpenAI | ❌ | Requires proxy |
| Gemini | ✅ | Direct browser calls supported |
| Ollama | ✅ | Local, configurable CORS |
| OpenRouter | ✅ | Designed for browser use |
| Groq | ❌ | Requires proxy |

For providers without CORS support, the package provides:
1. **Proxy configuration**: Point to your own thin proxy
2. **Service worker option**: Intercept and modify requests (experimental)
3. **Documentation**: Clear guidance on minimal proxy setup

## Security Model

### Key Storage
- Keys stored in localStorage by default (same security model as any client-side storage)
- Optional encryption layer using Web Crypto API with user-provided passphrase
- Keys never leave the browser except to call the provider API directly

### Validation
- Keys validated via low-cost API calls (list models, not completions)
- Validation results cached with TTL
- Invalid keys trigger events for UI feedback

### Recommendations
- Document that BYOK shifts API cost/risk to the user
- Recommend users create restricted/scoped API keys where possible
- Clear key data on logout/session end

## Event System

```typescript
type BYOKEvent =
  | { type: 'key:added'; providerId: string; }
  | { type: 'key:removed'; providerId: string; }
  | { type: 'key:validated'; providerId: string; valid: boolean; }
  | { type: 'key:validation-failed'; providerId: string; error: Error; }
  | { type: 'provider:registered'; providerId: string; }
  | { type: 'state:changed'; state: BYOKState; };
```

## Usage Examples

### Basic Setup

```typescript
import { createBYOKClient } from '@byo-keys/core';
import { anthropic, openai, gemini, ollama } from '@byo-keys/providers';

const client = createBYOKClient({
  providers: [anthropic(), openai(), gemini(), ollama()],
  storage: 'localStorage', // default
});

// Register a key
const result = await client.setKey('anthropic', 'sk-ant-...');
if (result.valid) {
  console.log('Key validated, available models:', result.models);
}

// Use the API
const response = await client.chat('anthropic', {
  model: 'claude-sonnet-4-20250514',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### SvelteKit Integration

```typescript
// lib/byok.ts
import { createBYOKClient } from '@byo-keys/core';
import { createSvelteStores } from '@byo-keys/svelte';

const client = createBYOKClient({ /* ... */ });
export const { keys, providers, chat } = createSvelteStores(client);
```

```svelte
<script>
  import { keys, providers, chat } from '$lib/byok';
  
  let apiKey = '';
  
  async function saveKey() {
    const result = await keys.set('anthropic', apiKey);
    if (!result.valid) {
      alert('Invalid key: ' + result.error);
    }
  }
</script>

{#if $keys.anthropic}
  <p>✓ Anthropic key configured</p>
{:else}
  <input bind:value={apiKey} type="password" />
  <button on:click={saveKey}>Save Key</button>
{/if}
```

## Package Structure

```
packages/
├── core/                    # Main package, zero dependencies
│   ├── src/
│   │   ├── client.ts       # BYOKClient implementation
│   │   ├── registry.ts     # Provider registry
│   │   ├── storage/        # Storage implementations
│   │   ├── events.ts       # Event emitter
│   │   ├── types.ts        # Core type definitions
│   │   └── index.ts        # Public API
│   └── package.json
│
├── providers/               # Provider implementations
│   ├── src/
│   │   ├── base.ts         # Abstract base provider
│   │   ├── anthropic.ts
│   │   ├── openai.ts
│   │   ├── gemini.ts
│   │   ├── ollama.ts
│   │   ├── openrouter.ts
│   │   ├── groq.ts
│   │   └── together.ts
│   └── package.json
│
├── svelte/                  # Svelte/SvelteKit adapter
│   ├── src/
│   │   ├── stores.ts
│   │   ├── components/     # Optional UI components
│   │   └── index.ts
│   └── package.json
│
└── react/                   # React adapter (future)
    └── ...
```

## API Design Goals

1. **Progressive disclosure**: Simple things simple, complex things possible
2. **Type inference**: Minimize explicit type annotations
3. **Errors as values**: Return results, throw only for programming errors
4. **Streaming first**: Async iterables for natural streaming support
5. **Tree-shakeable**: Only include providers you use
