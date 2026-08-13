# BYO-Keys

**Bring Your Own Key** for LLM-powered web applications.

A framework-agnostic TypeScript library that makes it easy to build web apps where users provide their own API keys. Keys are stored securely in the browser and never touch your servers.

## Features

- 🔑 **Browser-native key storage** with optional encryption
- 🌊 **Streaming-first** async iterables for real-time responses
- 🔌 **Provider adapters** for Anthropic, OpenAI, Gemini, Ollama, and more
- ⚡ **Zero dependencies** in the core package
- 🎯 **Framework adapters** for Svelte, React (coming soon)
- 📦 **Tree-shakeable** — only bundle what you use
- 🔒 **Type-safe** with full TypeScript coverage

## Installation

```bash
# Core package
npm install @byo-keys/core

# Provider implementations
npm install @byo-keys/providers

# Framework adapter (optional)
npm install @byo-keys/svelte
```

## Quick Start

```typescript
import { createBYOKClient } from '@byo-keys/core';
import { anthropic, openai, ollama } from '@byo-keys/providers';

// Create a client with your chosen providers
const client = createBYOKClient({
  providers: [
    anthropic(),
    openai(),
    ollama(), // Local inference, no key required
  ],
});

// Initialize (loads stored keys from localStorage)
await client.initialize();

// Set an API key (validates and stores it)
const result = await client.setKey('anthropic', 'sk-ant-...');

if (result.valid) {
  // Send a chat request
  const response = await client.chat('anthropic', {
    model: 'claude-sonnet-4-20250514',
    messages: [{ role: 'user', content: 'Hello!' }],
  });

  console.log(response.content);
}
```

## Streaming

```typescript
// Streaming responses with async iterables
for await (const chunk of client.chatStream('anthropic', {
  model: 'claude-sonnet-4-20250514',
  messages: [{ role: 'user', content: 'Write a haiku about coding' }],
})) {
  if (chunk.type === 'delta') {
    process.stdout.write(chunk.content);
  }
}
```

## SvelteKit Integration

```typescript
// src/lib/byok.ts
import { createBYOKClient } from '@byo-keys/core';
import { anthropic, openai } from '@byo-keys/providers';
import { createBYOKStores } from '@byo-keys/svelte';

const client = createBYOKClient({
  providers: [anthropic(), openai()],
});

export const byok = createBYOKStores(client);
```

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { onMount } from 'svelte';
  import { byok } from '$lib/byok';
  import { setBYOKContext, initializeBYOK } from '@byo-keys/svelte';

  setBYOKContext(byok);
  onMount(() => initializeBYOK(byok));
</script>

<slot />
```

```svelte
<!-- Any component -->
<script>
  import { getBYOKContext } from '@byo-keys/svelte';

  const { keys, setKey, chat } = getBYOKContext();

  let apiKey = '';

  async function saveKey() {
    const result = await setKey('anthropic', apiKey);
    if (!result.valid) alert(result.error);
  }
</script>

{#if $keys.anthropic?.isValid}
  <p>✓ Anthropic connected</p>
{:else}
  <input type="password" bind:value={apiKey} />
  <button on:click={saveKey}>Save Key</button>
{/if}
```

## Providers

| Provider | CORS Support | Key Required | Best For |
|----------|-------------|--------------|----------|
| Anthropic | ❌ (proxy needed) | Yes | Claude models, reasoning |
| OpenAI | ❌ (proxy needed) | Yes | GPT-4, o-series models |
| Gemini | ✅ Native | Yes | Browser-first apps |
| OpenRouter | ✅ Native | Yes | Multi-model access |
| Hugging Face | ✅ Native | Yes | Open models, multi-provider routing |
| Groq | ❌ (proxy needed) | Yes | Ultra-fast inference |
| Together | ❌ (proxy needed) | Yes | Open-source models |
| Mistral | ❌ (proxy needed) | Yes | European AI, efficiency |
| Ollama | ✅ Local | No | Private, local inference |

### Anthropic

```typescript
import { anthropic } from '@byo-keys/providers';

const provider = anthropic({
  // For development: enable direct browser access
  dangerouslyAllowBrowser: true,

  // For production: use a proxy
  proxyUrl: '/api/proxy/anthropic',
});
```

### OpenAI

```typescript
import { openai } from '@byo-keys/providers';

const provider = openai({
  organization: 'org-...',  // Optional
  proxyUrl: '/api/proxy/openai',
});
```

### Google Gemini

```typescript
import { gemini } from '@byo-keys/providers';

// Gemini supports CORS natively — no proxy needed!
const provider = gemini();
```

### OpenRouter

```typescript
import { openrouter } from '@byo-keys/providers';

// OpenRouter supports CORS natively — no proxy needed!
// Access 100+ models from a single API
const provider = openrouter({
  siteUrl: 'https://yourapp.com',  // Optional attribution
  siteName: 'Your App',
});
```

### Hugging Face

```typescript
import { huggingface } from '@byo-keys/providers';

// The Inference Providers router supports CORS natively — no proxy needed!
// Get a token at https://huggingface.co/settings/tokens
const provider = huggingface();

// Model ids are "org/model" with an optional routing suffix:
//   "meta-llama/Llama-3.3-70B-Instruct"           → router default (:fastest)
//   "meta-llama/Llama-3.3-70B-Instruct:cerebras"  → pin a specific provider
//   "meta-llama/Llama-3.3-70B-Instruct:cheapest"  → cheapest available provider
```

Note: model pricing reported by `listModels()` reflects the cheapest available
inference provider; the router's default `:fastest` route may cost more.

### Groq

```typescript
import { groq } from '@byo-keys/providers';

const provider = groq({
  proxyUrl: '/api/proxy/groq',
});
```

### Together AI

```typescript
import { together } from '@byo-keys/providers';

const provider = together({
  proxyUrl: '/api/proxy/together',
});
```

### Mistral AI

```typescript
import { mistral } from '@byo-keys/providers';

const provider = mistral({
  proxyUrl: '/api/proxy/mistral',
});
```

### Ollama (Local)

```typescript
import { ollama } from '@byo-keys/providers';

const provider = ollama({
  baseUrl: 'http://localhost:11434', // Default
});

// Ollama doesn't require an API key
// Just check if the server is running:
const isRunning = await provider.checkConnection();
```

### Using Provider Metadata

```typescript
import { PROVIDER_METADATA } from '@byo-keys/providers';

// Build dynamic UI from provider metadata
Object.entries(PROVIDER_METADATA).map(([id, meta]) => ({
  id,
  name: meta.name,
  description: meta.description,
  supportsCORS: meta.supportsCORS,
  keyPlaceholder: meta.keyPlaceholder,
}));
```

## CORS Handling

Most LLM providers don't support CORS, meaning you can't call them directly from the browser. You have three options:

### 1. Use a Proxy (Recommended for Production)

Create a simple passthrough proxy on your server:

```typescript
// SvelteKit: src/routes/api/proxy/[...path]/+server.ts
export const POST = async ({ params, request }) => {
  const [provider, ...rest] = params.path.split('/');
  const baseUrl = { anthropic: 'https://api.anthropic.com' }[provider];

  return fetch(`${baseUrl}/${rest.join('/')}`, {
    method: 'POST',
    headers: request.headers,
    body: request.body,
  });
};
```

### 2. Use Browser-Safe Providers

Some providers support CORS:
- **Ollama**: Local, CORS configurable
- **OpenRouter**: Designed for browser use
- **Hugging Face**: Inference Providers router supports CORS
- **Google AI (Gemini)**: Supports CORS

### 3. Development Mode (Anthropic Only)

For development, Anthropic allows direct browser access with a special header:

```typescript
anthropic({ dangerouslyAllowBrowser: true })
```

⚠️ **Never use this in production** — it exposes API keys in network requests.

## Encrypted Storage

For additional security, enable key encryption:

```typescript
import { EncryptedStorage } from '@byo-keys/core';

const storage = new EncryptedStorage();
await storage.setEncryptionKey('user-provided-passphrase');

const client = createBYOKClient({
  providers: [...],
  storage,
});
```

Keys are encrypted using AES-256-GCM via the Web Crypto API.

## API Reference

### `createBYOKClient(config)`

Creates a new BYOK client.

```typescript
interface BYOKClientConfig {
  providers: LLMProvider[];
  storage?: KeyStorage | StorageOptions;
  autoValidate?: boolean;  // Default: true
  validationCacheTTL?: number;  // Default: 1 hour
}
```

### `client.setKey(providerId, key, metadata?)`

Validates and stores an API key.

```typescript
const result = await client.setKey('anthropic', 'sk-...');
// { valid: true, providerId: 'anthropic', models: [...] }
// { valid: false, providerId: 'anthropic', error: 'Invalid key' }
```

### `client.chat(providerId, request)`

Send a chat completion request.

```typescript
const response = await client.chat('openai', {
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
  maxTokens: 1000,
  temperature: 0.7,
});
```

### `client.chatStream(providerId, request)`

Send a streaming chat request.

```typescript
for await (const chunk of client.chatStream('anthropic', request)) {
  switch (chunk.type) {
    case 'start': console.log('Started:', chunk.id); break;
    case 'delta': process.stdout.write(chunk.content); break;
    case 'usage': console.log('Tokens:', chunk.usage); break;
    case 'done': console.log('Finished:', chunk.finishReason); break;
  }
}
```

### `client.subscribe(listener)`

Subscribe to state changes.

```typescript
const unsubscribe = client.subscribe((event) => {
  if (event.type === 'key:validated') {
    console.log(`${event.providerId}: ${event.result.valid}`);
  }
});
```

## Security Considerations

1. **Keys stay in the browser**: API keys are stored in localStorage and sent directly to providers. Your server never sees them.

2. **Users control their keys**: Users can add, remove, and manage their own keys.

3. **Recommend scoped keys**: Encourage users to create API keys with minimal permissions.

4. **Clear on logout**: Call `client.destroy()` or clear localStorage when users log out.

5. **HTTPS required**: Always serve your app over HTTPS in production.

## License

MIT
