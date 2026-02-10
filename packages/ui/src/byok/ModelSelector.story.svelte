<script lang="ts" module>
  export const meta = {
    title: 'ModelSelector',
    description: 'Model picker with provider tabs and search',
    category: 'BYOK',
  };
</script>

<script lang="ts">
  import BYOKPreview from '../../stories/src/lib/BYOKPreview.svelte';
  import ModelSelector from './ModelSelector.svelte';

  let providerId = $state('openai');
  let modelId = $state('');

  // Static config for demo without API keys
  const staticConfig = {
    providers: {
      openai: {
        name: 'OpenAI',
        defaultModel: 'gpt-4-turbo',
        models: [
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000, inputPricePerMillion: 10, outputPricePerMillion: 30, capabilities: { vision: true, functionCalling: true, streaming: true } },
          { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, inputPricePerMillion: 5, outputPricePerMillion: 15, capabilities: { vision: true, functionCalling: true, streaming: true, audio: true } },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, inputPricePerMillion: 0.15, outputPricePerMillion: 0.60, capabilities: { vision: true, functionCalling: true, streaming: true } },
        ],
      },
      anthropic: {
        name: 'Anthropic',
        defaultModel: 'claude-3-5-sonnet-20241022',
        models: [
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000, inputPricePerMillion: 3, outputPricePerMillion: 15, capabilities: { vision: true, functionCalling: true, streaming: true } },
          { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', contextWindow: 200000, inputPricePerMillion: 15, outputPricePerMillion: 75, capabilities: { vision: true, functionCalling: true, streaming: true } },
          { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', contextWindow: 200000, inputPricePerMillion: 0.25, outputPricePerMillion: 1.25, capabilities: { vision: true, functionCalling: true, streaming: true } },
        ],
      },
      gemini: {
        name: 'Google Gemini',
        defaultModel: 'gemini-1.5-pro',
        models: [
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2000000, inputPricePerMillion: 1.25, outputPricePerMillion: 5, capabilities: { vision: true, functionCalling: true, streaming: true, audio: true } },
          { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, inputPricePerMillion: 0.075, outputPricePerMillion: 0.30, capabilities: { vision: true, functionCalling: true, streaming: true } },
        ],
      },
    },
  };
</script>

<section>
  <h3>Live Preview (Static Config)</h3>
  <p style="margin: 0 0 1rem 0; color: var(--tx-2); font-size: 0.875rem;">
    Using static model configuration - no API keys required. Click to open the model picker.
  </p>
  <BYOKPreview>
    {#snippet children({ stores })}
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <ModelSelector
          {stores}
          config={staticConfig}
          bind:providerId
          bind:modelId
        />
        <p style="margin: 0; color: var(--tx-2); font-size: 0.875rem;">
          Selected: <code>{providerId}/{modelId}</code>
        </p>
      </div>
    {/snippet}
  </BYOKPreview>
</section>

<section>
  <h3>Dynamic Mode</h3>
  <p style="margin: 0 0 1rem 0; color: var(--tx-2); font-size: 0.875rem;">
    Without <code>config</code>, uses models from BYOK stores. Add an API key first to fetch available models.
  </p>
  <BYOKPreview>
    {#snippet children({ stores })}
      <ModelSelector {stores} />
    {/snippet}
  </BYOKPreview>
</section>

<section>
  <h3>Usage</h3>
  <pre style="
    padding: 1rem;
    background-color: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: 0.25rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--tx);
    overflow-x: auto;
  ">{`<script>
  import { ModelSelector } from '@wri-datalab/ui';
  import { getBYOKContext } from '@byo-keys/svelte';

  const stores = getBYOKContext();
  let providerId = $state('openai');
  let modelId = $state('gpt-4-turbo');

  // Optional: static config
  const config = {
    providers: {
      openai: {
        name: 'OpenAI',
        defaultModel: 'gpt-4-turbo',
        models: [
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000 },
          { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000 },
        ],
      },
    },
  };
</script>

<ModelSelector
  {stores}
  {config}
  bind:providerId
  bind:modelId
/>`}</pre>
</section>

<section>
  <h3>Props</h3>
  <div style="
    padding: 1rem;
    background-color: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: 0.25rem;
    font-size: 0.875rem;
  ">
    <ul style="margin: 0; padding-left: 1.25rem; color: var(--tx-2);">
      <li><code>stores</code> - BYOK stores instance (required)</li>
      <li><code>config</code> - Static model configuration (optional)</li>
      <li><code>providerId</code> - Selected provider ID (bindable)</li>
      <li><code>modelId</code> - Selected model ID (bindable)</li>
      <li><code>compact</code> - Show as compact trigger button (default: true)</li>
      <li><code>onselect</code> - Callback when model is selected</li>
    </ul>
  </div>
</section>

<section>
  <h3>Features</h3>
  <div style="
    padding: 1rem;
    background-color: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: 0.25rem;
    font-size: 0.875rem;
  ">
    <ul style="margin: 0; padding-left: 1.25rem; color: var(--tx-2);">
      <li>Modal dialog with provider tabs</li>
      <li>Search/filter models by name</li>
      <li>Shows model details (context window, pricing)</li>
      <li>Capability badges (Vision, Tools, Stream)</li>
      <li>Warns when API key is not configured</li>
      <li>Keyboard navigation (Escape to close)</li>
    </ul>
  </div>
</section>
