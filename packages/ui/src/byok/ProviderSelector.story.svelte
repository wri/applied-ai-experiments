<script lang="ts" module>
  export const meta = {
    title: 'ProviderSelector',
    description: 'Dropdown to select an LLM provider',
    category: 'BYOK',
  };
</script>

<script lang="ts">
  import BYOKPreview from '../../stories/src/lib/BYOKPreview.svelte';
  import ProviderSelector from './ProviderSelector.svelte';

  let selectedProvider = $state('');
</script>

<section>
  <h3>Live Preview</h3>
  <p style="margin: 0 0 1rem 0; color: var(--tx-2); font-size: 0.875rem;">
    Shows providers that have valid API keys. Add a key in ApiKeyManager first to see providers appear.
  </p>
  <BYOKPreview>
    {#snippet children({ stores })}
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <ProviderSelector {stores} bind:value={selectedProvider} onlyReady={true} />
        {#if selectedProvider}
          <p style="margin: 0; color: var(--tx-2); font-size: 0.875rem;">
            Selected: <code>{selectedProvider}</code>
          </p>
        {/if}
      </div>
    {/snippet}
  </BYOKPreview>
</section>

<section>
  <h3>Show All Providers</h3>
  <p style="margin: 0 0 1rem 0; color: var(--tx-2); font-size: 0.875rem;">
    With <code>onlyReady={'{'}false{'}'}</code>, shows all configured providers regardless of key status.
  </p>
  <BYOKPreview>
    {#snippet children({ stores })}
      <ProviderSelector {stores} onlyReady={false} />
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
  import { ProviderSelector } from '@wri-datalab/ui';
  import { getBYOKContext } from '@byo-keys/svelte';

  const stores = getBYOKContext();
  let provider = $state('');
</script>

<ProviderSelector
  {stores}
  bind:value={provider}
  label="AI Provider"
  onlyReady={true}
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
      <li><code>value</code> - Currently selected provider ID (bindable)</li>
      <li><code>onlyReady</code> - Only show providers with valid API keys (default: true)</li>
      <li><code>label</code> - Label text (default: "Provider")</li>
      <li><code>placeholder</code> - Placeholder text</li>
    </ul>
  </div>
</section>
