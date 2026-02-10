<script lang="ts" module>
  export const meta = {
    title: 'Toggle',
    description: 'Boolean switch input with various sizes and states',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import Toggle from './Toggle.svelte';

  let enabled = $state(false);
  let darkMode = $state(true);
  let notifications = $state(true);
</script>

<section>
  <h3>States</h3>
  <div style="display: flex; flex-direction: column; gap: 1rem;">
    <div style="display: flex; align-items: center; gap: 2rem;">
      <Toggle bind:checked={enabled} />
      <span style="font-size: var(--font-size-sm); color: var(--tx-3);">
        Value: {enabled ? 'On' : 'Off'}
      </span>
    </div>
    <div style="display: flex; align-items: center; gap: 2rem;">
      <Toggle checked={true} />
      <span style="font-size: var(--font-size-sm); color: var(--tx-3);">Always on</span>
    </div>
    <div style="display: flex; align-items: center; gap: 2rem;">
      <Toggle checked={false} />
      <span style="font-size: var(--font-size-sm); color: var(--tx-3);">Always off</span>
    </div>
  </div>
</section>

<section>
  <h3>Sizes</h3>
  <div style="display: flex; align-items: center; gap: 2rem;">
    <Toggle size="sm" checked={true} />
    <Toggle size="md" checked={true} />
    <Toggle size="lg" checked={true} />
  </div>
</section>

<section>
  <h3>With Labels</h3>
  <div style="display: flex; flex-direction: column; gap: 1rem;">
    <Toggle bind:checked={darkMode} label="Dark mode" />
    <Toggle bind:checked={notifications} label="Enable notifications" labelPosition="left" />
    <Toggle label="Label on right (default)" />
  </div>
</section>

<section>
  <h3>Disabled</h3>
  <div style="display: flex; flex-direction: column; gap: 1rem;">
    <Toggle disabled checked={true} label="Enabled but disabled" />
    <Toggle disabled checked={false} label="Disabled and off" />
  </div>
</section>

<section>
  <h3>Settings Example</h3>
  <div style="
    display: flex;
    flex-direction: column;
    gap: 0;
    max-width: 400px;
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    overflow: hidden;
  ">
    {#each [
      { label: 'Email notifications', checked: true },
      { label: 'Push notifications', checked: false },
      { label: 'Marketing emails', checked: false },
      { label: 'Weekly digest', checked: true },
    ] as setting, i}
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        border-bottom: {i < 3 ? '1px solid var(--ui)' : 'none'};
      ">
        <span style="font-family: var(--font-ui); font-size: var(--text-body-font-size);">
          {setting.label}
        </span>
        <Toggle size="sm" checked={setting.checked} />
      </div>
    {/each}
  </div>
</section>
