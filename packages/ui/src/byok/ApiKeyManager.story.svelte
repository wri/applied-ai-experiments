<script lang="ts" module>
  export const meta = {
    title: 'ApiKeyManager',
    description: 'Manage API keys for multiple providers',
    category: 'BYOK',
  };
</script>

<script lang="ts">
  import BYOKPreview from '../../stories/src/lib/BYOKPreview.svelte';
  import ApiKeyManager from './ApiKeyManager.svelte';
</script>

<section>
  <h3>Live Preview</h3>
  <p style="margin: 0 0 1rem 0; color: var(--tx-2); font-size: 0.875rem;">
    Interactive component using in-memory storage (keys won't persist on refresh).
  </p>
  <BYOKPreview>
    {#snippet children({ stores })}
      <ApiKeyManager {stores} />
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
  import { ApiKeyManager } from '@wri-datalab/ui';
  import { initializeBYOK, getBYOKContext } from '@byo-keys/svelte';

  // Initialize BYOK in your app's root
  initializeBYOK({ providers: [...] });

  // Get stores from context
  const stores = getBYOKContext();
</script>

<ApiKeyManager {stores} />`}</pre>
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
      <li><code>providers</code> - Filter to specific provider IDs</li>
      <li><code>showAll</code> - Show all providers or only those requiring keys (default: true)</li>
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
      <li>Validates API keys against provider endpoints</li>
      <li>Shows key status badges (Valid, Invalid, Not configured)</li>
      <li>Securely stores keys with optional encryption</li>
      <li>Links to provider API key pages</li>
      <li>Supports removing/replacing keys</li>
    </ul>
  </div>
</section>
