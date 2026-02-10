<script lang="ts">
  import type { BYOKStores } from '@byo-keys/svelte';
  import type { ProviderId } from '@byo-keys/core';
  import UserSettingsTrigger from './UserSettingsTrigger.svelte';
  import UserSettingsPopover from './UserSettingsPopover.svelte';
  import ApiKeyManager from '../../byok/ApiKeyManager.svelte';
  import ThemeSwitcher from '../ThemeSwitcher.svelte';

  interface Props {
    stores: BYOKStores;
    providers?: ProviderId[];
    position?: 'bottom-left' | 'bottom-right' | 'bottom-center';
    showTheme?: boolean;
    showApiKeys?: boolean;
    class?: string;
  }

  let {
    stores,
    providers,
    position = 'bottom-right',
    showTheme = true,
    showApiKeys = true,
    class: className = '',
  }: Props = $props();

  let isOpen = $state(false);
  let triggerElement: HTMLElement | null = $state(null);

  function handleTriggerClick(event: MouseEvent) {
    event.stopPropagation();
    isOpen = !isOpen;
  }

  function handleClose() {
    isOpen = false;
  }

  const sectionStyles = `
    padding: 1rem;
    border-bottom: 1px solid var(--ui);
  `;

  const sectionTitleStyles = `
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tx-2);
    margin: 0 0 0.75rem 0;
  `;
</script>

<div class="ui-user-settings {className}" bind:this={triggerElement}>
  <UserSettingsTrigger
    active={isOpen}
    onclick={handleTriggerClick}
  />

  <UserSettingsPopover
    open={isOpen}
    {position}
    anchorElement={triggerElement}
    onclickoutside={handleClose}
  >
    {#if showApiKeys && stores}
      <div style="{sectionStyles}">
        <h3 style="{sectionTitleStyles}">API Keys</h3>
        <ApiKeyManager stores={stores} providers={providers} showAll={false} />
      </div>
    {/if}

    {#if showTheme}
      <div style="{sectionStyles} border-bottom: none;">
        <h3 style="{sectionTitleStyles}">Theme</h3>
        <ThemeSwitcher />
      </div>
    {/if}
  </UserSettingsPopover>
</div>
