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

## Real-time Voice Sessions

The `@byo-keys/realtime` package enables voice conversations using OpenAI Realtime and Gemini Live APIs.

```bash
npm install @byo-keys/realtime
```

### Quick Example

```typescript
import { openaiRealtime, createAudioCapture, createAudioPlayback } from '@byo-keys/realtime';

// Create a voice session
const session = openaiRealtime({
  model: 'gpt-4o-realtime-preview-2024-12-17',
  voice: 'alloy',
  instructions: 'You are a helpful assistant.',
});

// Set API key and connect
session.setApiKey('sk-...');
await session.connect();

// Set up audio capture (microphone)
const capture = createAudioCapture({ sampleRate: 24000 });
capture.onAudioChunk((chunk) => session.sendAudio(chunk));

// Set up audio playback (speaker)
const playback = createAudioPlayback({ sampleRate: 24000 });
await playback.initialize();

// Handle events
session.subscribe((event) => {
  switch (event.type) {
    case 'transcript:delta':
      console.log(`${event.role}: ${event.delta}`);
      break;
    case 'response:audio_delta':
      playback.enqueue(event.audio);
      break;
    case 'tool:call':
      // Handle function calls
      const result = await myFunction(event.arguments);
      session.submitToolResult(event.callId, result);
      break;
  }
});

// Start listening
await capture.start();
```

### Providers

| Provider | CORS | Sample Rate | Voices |
|----------|------|-------------|--------|
| OpenAI Realtime | ❌ | 24kHz | alloy, echo, fable, onyx, nova, shimmer |
| Gemini Live | ✅ | 16kHz | Puck, Charon, Kore, Fenrir, Aoede |

### OpenAI Realtime

```typescript
import { openaiRealtime } from '@byo-keys/realtime';

const session = openaiRealtime({
  model: 'gpt-4o-realtime-preview-2024-12-17',
  voice: 'nova',
  instructions: 'Be concise and friendly.',
  vadEnabled: true,           // Voice activity detection
  vadThreshold: 0.5,          // Sensitivity (0-1)
  silenceDurationMs: 500,     // Silence before turn end
  tools: [{                   // Function calling
    type: 'function',
    name: 'get_weather',
    description: 'Get weather for a location',
    parameters: { type: 'object', properties: { location: { type: 'string' } } }
  }],
}, {
  enableTranscription: true,  // Get text transcripts
});
```

### Gemini Live

```typescript
import { geminiLive } from '@byo-keys/realtime';

const session = geminiLive({
  model: 'gemini-2.0-flash-exp',
  voice: 'Kore',
  instructions: 'You are a helpful assistant.',
});

// Gemini supports vision in realtime!
session.sendImage(base64ImageData, 'image/jpeg');
session.sendTextAndImage('What is this?', base64Data);
```

### Audio Capture Options

```typescript
import { createAudioCapture, createLegacyAudioCapture } from '@byo-keys/realtime';

// Modern AudioWorklet-based capture (recommended)
const capture = createAudioCapture({
  sampleRate: 24000,          // Match provider's rate
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  chunkSize: 4800,            // Samples per chunk
});

// Legacy ScriptProcessor-based (better compatibility)
const legacyCapture = createLegacyAudioCapture({ sampleRate: 24000 });

// Volume monitoring
capture.onVolumeLevel((level) => {
  volumeMeter.style.width = `${level * 100}%`;
});
```

### Streaming Audio Playback

```typescript
import { createStreamingPlayer } from '@byo-keys/realtime';

// Better for continuous streaming with jitter handling
const player = createStreamingPlayer(24000);
await player.initialize();

session.subscribe((event) => {
  if (event.type === 'response:audio_delta') {
    player.addAudio(event.audio);
  }
});

// Interrupt playback
player.clear();
```

### Session Lifecycle

```typescript
// Connect
await session.connect();

// Send text (bypasses voice input)
session.sendText('Hello!');

// Manually commit audio buffer (if turn detection disabled)
session.commitAudio();

// Interrupt current response
session.interrupt();

// Update configuration mid-session
session.updateConfig({ 
  voice: 'shimmer',
  temperature: 0.8 
});

// Disconnect
session.disconnect();
```

## License

MIT
