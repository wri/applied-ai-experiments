# @byo-keys/core

The provider-agnostic core of the BYOK (Bring-Your-Own-Key) toolkit: the client
orchestrator, the shared types every provider speaks, key storage, and the base class
custom providers extend.

**Main exports**
- `createBYOKClient(config)` — the orchestrator: registers providers, validates/stores
  keys, exposes `chat()` / `chatStream()`, model lists, and state subscription.
- Storage: `createStorage`, `LocalStorage`, `MemoryStorage`, `EncryptedStorage`.
- `BaseProvider`, `parseSSE` — extend/implement a custom provider.
- Types: `ProviderId`, `Message`, `ChatRequest`, `ChatResponse`, `ChatStreamChunk`,
  `TokenUsage`, `FinishReason`, `LLMProvider`, `ModelInfo`, `KeyStorage`, … (the
  vocabulary used across `@byo-keys/*`, `@wri-datalab/ui`, and `@wri-datalab/llm-lab`).

Usage, provider setup, and CORS notes live in the top-level
[byo-keys README](../../README.md); the design is in [ARCHITECTURE.md](../../ARCHITECTURE.md).
