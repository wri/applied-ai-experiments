<script lang="ts" module>
  export const meta = {
    title: 'Tabs',
    description: 'Tab navigation with keyboard support',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import Tabs from './Tabs.svelte';

  let activeTab = $state('overview');
  let activeSize = $state('overview');

  const items = [
    { id: 'overview', label: 'Overview' },
    { id: 'settings', label: 'Settings' },
    { id: 'logs', label: 'Logs' },
    { id: 'metrics', label: 'Metrics' },
  ];

  const itemsWithDisabled = [
    { id: 'active', label: 'Active' },
    { id: 'pending', label: 'Pending' },
    { id: 'archived', label: 'Archived', disabled: true },
    { id: 'deleted', label: 'Deleted', disabled: true },
  ];
</script>

<section>
  <h3>Basic Tabs</h3>
  <div>
    <Tabs {items} bind:active={activeTab} />
    <div style="padding: 1rem; background-color: var(--bg-2); border: 1px solid var(--ui); border-top: none;">
      <p style="margin: 0; color: var(--tx-2);">
        Currently viewing: <strong style="color: var(--tx);">{activeTab}</strong>
      </p>
    </div>
  </div>
</section>

<section>
  <h3>Sizes</h3>
  <div style="display: flex; flex-direction: column; gap: 2rem;">
    <div>
      <p style="margin: 0 0 0.5rem 0; font-size: 0.75rem; color: var(--tx-3); text-transform: uppercase;">Small</p>
      <Tabs items={items} bind:active={activeSize} size="sm" />
    </div>
    <div>
      <p style="margin: 0 0 0.5rem 0; font-size: 0.75rem; color: var(--tx-3); text-transform: uppercase;">Medium (default)</p>
      <Tabs items={items} bind:active={activeSize} size="md" />
    </div>
  </div>
</section>

<section>
  <h3>With Disabled Items</h3>
  <Tabs items={itemsWithDisabled} active="active" />
</section>

<section>
  <h3>Keyboard Navigation</h3>
  <p style="margin: 0 0 1rem 0; color: var(--tx-2); font-size: 0.875rem;">
    Use arrow keys to navigate between tabs. Home/End jump to first/last tab.
  </p>
  <Tabs items={items} active="overview" />
</section>
