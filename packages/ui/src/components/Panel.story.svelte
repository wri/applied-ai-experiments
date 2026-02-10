<script lang="ts" module>
  export const meta = {
    title: 'Panel',
    description: 'Collapsible container with optional title and actions',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import Panel from './Panel.svelte';
  import Button from './Button.svelte';
  import Badge from './Badge.svelte';
</script>

<section>
  <h3>Basic Panel</h3>
  <div style="max-width: 400px;">
    <Panel>
      <p style="margin: 0; color: var(--tx-2);">
        Panel content goes here. This is a basic panel without a title.
      </p>
    </Panel>
  </div>
</section>

<section>
  <h3>With Title</h3>
  <div style="max-width: 400px;">
    <Panel title="Configuration">
      <p style="margin: 0; color: var(--tx-2);">
        Settings and configuration options would appear here.
      </p>
    </Panel>
  </div>
</section>

<section>
  <h3>With Header Actions</h3>
  <div style="max-width: 400px;">
    <Panel title="API Keys">
      {#snippet actions()}
        <Badge variant="success">3 configured</Badge>
      {/snippet}
      <p style="margin: 0; color: var(--tx-2);">
        Manage your API keys for different providers.
      </p>
    </Panel>
  </div>
</section>

<section>
  <h3>Collapsible</h3>
  <div style="max-width: 400px; display: flex; flex-direction: column; gap: 1rem;">
    <Panel title="Advanced Settings" collapsible>
      <p style="margin: 0; color: var(--tx-2);">
        These are advanced settings that most users won't need to change.
      </p>
    </Panel>
    <Panel title="Collapsed by Default" collapsible collapsed>
      <p style="margin: 0; color: var(--tx-2);">
        This panel starts collapsed. Click the header to expand.
      </p>
    </Panel>
  </div>
</section>

<section>
  <h3>Complex Content</h3>
  <div style="max-width: 400px;">
    <Panel title="Model Information">
      {#snippet actions()}
        <Button size="sm" variant="ghost">Edit</Button>
      {/snippet}
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--tx-3); font-size: 0.875rem;">Model</span>
          <span style="font-family: var(--font-mono); color: var(--tx);">gpt-4-turbo</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--tx-3); font-size: 0.875rem;">Context</span>
          <span style="font-family: var(--font-mono); color: var(--tx);">128K tokens</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--tx-3); font-size: 0.875rem;">Status</span>
          <Badge variant="success">Ready</Badge>
        </div>
      </div>
    </Panel>
  </div>
</section>
