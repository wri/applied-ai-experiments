<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { BYOKStores } from '@byo-keys/svelte';
  import type { ProviderId } from '@byo-keys/core';
  import UserSettings from './user-settings/UserSettings.svelte';
  import ThemeSwitcher from './ThemeSwitcher.svelte';

  interface Props {
    title: string;
    subtitle?: string;
    stores?: BYOKStores;
    providers?: ProviderId[];
    showSettings?: boolean;
    showTheme?: boolean;
    showApiKeys?: boolean;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    actions?: Snippet;
    nav?: Snippet;
    class?: string;
  }

  let {
    title,
    subtitle,
    stores,
    providers,
    showSettings = true,
    showTheme = true,
    showApiKeys = true,
    maxWidth = 'lg',
    actions,
    nav,
    class: className = '',
  }: Props = $props();

  const maxWidthStyles = {
    sm: 'max-width: 640px;',
    md: 'max-width: 768px;',
    lg: 'max-width: 1024px;',
    xl: 'max-width: var(--max-width, 1200px);',
    full: 'max-width: 100%;',
  };
</script>

<header
  class="ui-demo-header {className}"
  style="
    background-color: var(--bg-2);
    border-bottom: 1px solid var(--ui);
    position: sticky;
    top: 0;
    z-index: var(--z-sticky);
  "
>
  <div
    class="header-content"
    style="
      {maxWidthStyles[maxWidth]}
      margin: 0 auto;
      padding: 0 var(--space-4);
      height: var(--header-height);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
    "
  >
    <div class="header-left" style="display: flex; align-items: center; gap: var(--space-3); min-width: 0;">
      <div class="header-title-group" style="min-width: 0;">
        <h1
          style="
            font-family: var(--font-mono);
            font-size: var(--text-title-md);
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--tx);
            margin: 0;
            line-height: 1.2;
            display: flex;
            align-items: center;
            gap: 0.5em;
          "
        >
          <span class="header-prefix" style="color: var(--tx-2);">Applied AI Experiments</span>
          <span class="header-separator" style="color: var(--tx-3);">/</span>
          <span class="header-title">{title}</span>
        </h1>
        {#if subtitle}
          <p
            style="
              font-size: var(--text-ui);
              color: var(--tx-2);
              margin: 0.125rem 0 0 0;
              line-height: 1.3;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            "
          >{subtitle}</p>
        {/if}
      </div>
    </div>

    <div class="header-right" style="display: flex; align-items: center; gap: var(--space-3); flex-shrink: 0;">
      {#if nav}
        <nav
          class="header-nav"
          style="
            display: flex;
            align-items: center;
            gap: var(--space-3);
            font-family: var(--font-mono);
            font-size: var(--text-ui);
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.025em;
          "
        >
          {@render nav()}
        </nav>
      {/if}

      {#if actions}
        <div class="header-actions" style="display: flex; align-items: center; gap: var(--space-2);">
          {@render actions()}
        </div>
      {/if}

      {#if showTheme}
        <ThemeSwitcher />
      {/if}

      {#if showSettings && showApiKeys && stores}
        <UserSettings
          {stores}
          {providers}
          showTheme={false}
          {showApiKeys}
          position="bottom-right"
        />
      {/if}
    </div>
  </div>
</header>
