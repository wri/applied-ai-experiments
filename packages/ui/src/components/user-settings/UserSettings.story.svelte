<script lang="ts" module>
  export const meta = {
    title: 'UserSettings',
    description: 'Settings popover with API keys and theme',
    category: 'Settings',
  };
</script>

<script lang="ts">
  import BYOKPreview from '../../../stories/src/lib/BYOKPreview.svelte';
  import UserSettings from './UserSettings.svelte';
  import UserSettingsTrigger from './UserSettingsTrigger.svelte';
</script>

<section>
  <h3>Trigger Button States</h3>
  <p style="margin: 0 0 1rem 0; color: var(--tx-2); font-size: 0.875rem;">
    The trigger button used to open the settings popover.
  </p>
  <div class="story-row">
    <UserSettingsTrigger active={false} />
    <UserSettingsTrigger active={true} />
    <span style="color: var(--tx-2); font-size: 0.875rem;">
      Inactive and active states
    </span>
  </div>
</section>

<section>
  <h3>Live Preview</h3>
  <p style="margin: 0 0 1rem 0; color: var(--tx-2); font-size: 0.875rem;">
    Click the settings icon to open the popover. Uses in-memory storage (keys won't persist).
  </p>
  <BYOKPreview>
    {#snippet children({ stores })}
      <UserSettings {stores} />
    {/snippet}
  </BYOKPreview>
</section>

<section>
  <h3>Theme Only</h3>
  <p style="margin: 0 0 1rem 0; color: var(--tx-2); font-size: 0.875rem;">
    With <code>showApiKeys={'{'}false{'}'}</code>, shows only the theme switcher.
  </p>
  <BYOKPreview>
    {#snippet children({ stores })}
      <UserSettings {stores} showApiKeys={false} />
    {/snippet}
  </BYOKPreview>
</section>

<section>
  <h3>In Header Context</h3>
  <div style="
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background-color: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: 0.25rem;
  ">
    <span style="font-family: var(--font-mono); color: var(--tx);">Applied AI / Demo App</span>
    <BYOKPreview>
      {#snippet children({ stores })}
        <UserSettings {stores} />
      {/snippet}
    </BYOKPreview>
  </div>
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
  import { UserSettings } from '@wri-datalab/ui';
  import { getBYOKContext } from '@byo-keys/svelte';

  const stores = getBYOKContext();
</script>

<!-- Full settings (API keys + theme) -->
<UserSettings {stores} />

<!-- API keys only -->
<UserSettings {stores} showTheme={false} />

<!-- Theme only -->
<UserSettings {stores} showApiKeys={false} />

<!-- Custom position -->
<UserSettings {stores} position="bottom-left" />`}</pre>
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
      <li><code>stores</code> - BYOK stores instance (required for API keys)</li>
      <li><code>providers</code> - Filter to specific provider IDs</li>
      <li><code>position</code> - Popover position: "bottom-left", "bottom-center", "bottom-right"</li>
      <li><code>showTheme</code> - Show theme switcher (default: true)</li>
      <li><code>showApiKeys</code> - Show API key manager (default: true)</li>
    </ul>
  </div>
</section>
