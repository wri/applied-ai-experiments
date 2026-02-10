<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { BYOKStores } from '@byo-keys/svelte';
  import type { ProviderId } from '@byo-keys/core';
  import DemoHeader from './DemoHeader.svelte';
  import DemoFooter from './DemoFooter.svelte';

  interface Props {
    title: string;
    description?: string;
    subtitle?: string;
    stores?: BYOKStores;
    providers?: ProviderId[];
    showSettings?: boolean;
    showTheme?: boolean;
    showApiKeys?: boolean;
    showFooter?: boolean;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    headerActions?: Snippet;
    headerNav?: Snippet;
    footer?: Snippet;
    children: Snippet;
    class?: string;
  }

  let {
    title,
    description,
    subtitle,
    stores,
    providers,
    showSettings = true,
    showTheme = true,
    showApiKeys = true,
    showFooter = true,
    maxWidth = 'lg',
    headerActions,
    headerNav,
    footer,
    children,
    class: className = '',
  }: Props = $props();
</script>

<svelte:head>
  <title>{title} | Applied AI Experiments</title>
  {#if description}
    <meta name="description" content={description} />
  {/if}
</svelte:head>

<div
  class="ui-demo-layout {className}"
  style="
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: var(--bg);
  "
>
  <DemoHeader
    {title}
    {subtitle}
    {stores}
    {providers}
    {showSettings}
    {showTheme}
    {showApiKeys}
    {maxWidth}
    actions={headerActions}
    nav={headerNav}
  />

  <main
    class="demo-main"
    style="
      flex: 1;
      width: 100%;
    "
  >
    {@render children()}
  </main>

  {#if showFooter}
    <DemoFooter {maxWidth}>
      {#if footer}
        {@render footer()}
      {/if}
    </DemoFooter>
  {/if}
</div>
