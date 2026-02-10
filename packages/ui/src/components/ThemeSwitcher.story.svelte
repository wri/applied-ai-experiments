<script lang="ts" module>
  export const meta = {
    title: 'ThemeSwitcher',
    description: 'Toggle between light, dark, and high-contrast themes',
    category: 'Settings',
  };
</script>

<script lang="ts">
  import ThemeSwitcher from './ThemeSwitcher.svelte';
</script>

<section>
  <h3>Default</h3>
  <div class="story-row">
    <ThemeSwitcher />
    <span style="color: var(--tx-2); font-size: 0.875rem;">
      Click to toggle light/dark. Option+click for high contrast.
    </span>
  </div>
</section>

<section>
  <h3>How It Works</h3>
  <div style="
    padding: 1rem;
    background-color: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: 0.25rem;
  ">
    <h4 style="margin: 0 0 0.5rem 0; font-family: var(--font-mono); font-size: 0.875rem; color: var(--tx);">Theme Modes</h4>
    <ul style="margin: 0; padding-left: 1.25rem; color: var(--tx-2); font-size: 0.875rem;">
      <li><strong>Light mode</strong> - Moon icon shown (click to go dark)</li>
      <li><strong>Dark mode</strong> - Sun icon shown (click to go light)</li>
      <li><strong>High contrast</strong> - Contrast icon shown (click to go light)</li>
    </ul>
  </div>
</section>

<section>
  <h3>Keyboard Shortcut</h3>
  <div style="
    padding: 1rem;
    background-color: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: 0.25rem;
  ">
    <p style="margin: 0; color: var(--tx-2); font-size: 0.875rem;">
      <kbd style="
        display: inline-block;
        padding: 0.125rem 0.375rem;
        font-family: var(--font-mono);
        font-size: 0.75rem;
        background-color: var(--bg-3);
        border: 1px solid var(--ui);
        border-radius: 0.125rem;
      ">⌥</kbd> + Click to toggle high contrast mode
    </p>
  </div>
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
    max-width: 400px;
  ">
    <span style="font-family: var(--font-mono); color: var(--tx);">My App</span>
    <ThemeSwitcher />
  </div>
</section>
