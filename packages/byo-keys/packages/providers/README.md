# @byo-keys/providers

Concrete LLM provider implementations for the BYOK client. Each is a factory you pass to
`createBYOKClient({ providers: [...] })`; all normalize responses to the shared
`@byo-keys/core` types (`ChatResponse`, `TokenUsage`, `ChatStreamChunk`).

**Main exports**
- Factories: `anthropic()`, `openai()`, `gemini()`, `mistral()`, `groq()`, `together()`,
  `openrouter()`, `huggingface()`, `ollama()`.
- `OpenAICompatProvider` — base for OpenAI-compatible endpoints (Groq/Together/HF/etc.).
- `PROVIDER_METADATA` — display name, CORS support, key placeholder, docs URL per provider.

**Note (build artifacts):** this package is consumed from committed **`dist/`** (no
source export condition). After editing `src/`, rebuild and commit the output:

```sh
pnpm --filter '@byo-keys/providers' build   # tsup --dts --clean; also type-checks
```

Per-provider setup, CORS strategies, and usage are in the top-level
[byo-keys README](../../README.md); the abstraction is in [ARCHITECTURE.md](../../ARCHITECTURE.md).
