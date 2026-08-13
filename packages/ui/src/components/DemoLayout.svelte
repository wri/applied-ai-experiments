<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { BYOKStores } from '@byo-keys/svelte';
  import type { ProviderId } from '@byo-keys/core';
  import DemoHeader from './DemoHeader.svelte';
  import DemoFooter from './DemoFooter.svelte';

  interface Props {
    title: string;
    /**
     * Page meta description, and the body of the header's info modal. Leave it
     * unset and the info modal reads app.html's `<meta name="description">`,
     * which sync-demo-meta.py generates from the brief's frontmatter.
     */
    description?: string;
    /** Link to this experiment's hub detail page, surfaced in the info modal. */
    infoHref?: string;
    showInfo?: boolean;
    /** Live/mock indicator in the header. Omit for demos with no model calls. */
    mode?: 'mock' | 'live';
    modeLabel?: string;
    modeHint?: string;
    onModeClick?: () => void;
    stores?: BYOKStores;
    providers?: ProviderId[];
    showSettings?: boolean;
    showTheme?: boolean;
    showApiKeys?: boolean;
    showFooter?: boolean;
    /**
     * App-shell demos that own the viewport — a map, a split pane — rather than
     * scrolling a document. Pins the layout to 100vh and makes `main` a flex
     * column, so a `flex: 1` child claims exactly the space the header and
     * banner don't. Without it those demos have to hardcode
     * `calc(100vh - <chrome>)`, which silently breaks the moment the chrome
     * gains a row.
     */
    fillHeight?: boolean;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    /** Header chrome only — telemetry triggers, engine toggles. */
    headerActions?: Snippet;
    /**
     * A labelled control row directly beneath the header: view tabs, exports,
     * per-demo toggles. Anything that needs a word rather than an icon goes
     * here, so the header itself stays the same shape across every demo.
     */
    banner?: Snippet;
    footer?: Snippet;
    children: Snippet;
    class?: string;
  }

  let {
    title,
    description,
    infoHref,
    showInfo = true,
    mode,
    modeLabel,
    modeHint,
    onModeClick,
    stores,
    providers,
    showSettings = true,
    showTheme = true,
    showApiKeys = true,
    showFooter = true,
    fillHeight = false,
    maxWidth = 'lg',
    headerActions,
    banner,
    footer,
    children,
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

<svelte:head>
  <title>{title} | Applied AI Experiments</title>
  {#if description}
    <meta name="description" content={description} />
  {/if}
</svelte:head>

<div class="ui-demo-layout {className}" class:fill-height={fillHeight}>
  <DemoHeader
    {title}
    {description}
    {infoHref}
    {showInfo}
    {mode}
    {modeLabel}
    {modeHint}
    {onModeClick}
    {stores}
    {providers}
    {showSettings}
    {showTheme}
    {showApiKeys}
    {maxWidth}
    actions={headerActions}
  />

  {#if banner}
    <div class="demo-banner">
      <div class="demo-banner-content" style={maxWidthStyles[maxWidth]}>
        {@render banner()}
      </div>
    </div>
  {/if}

  <main class="demo-main">
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

<style>
  .ui-demo-layout {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: var(--bg);
  }

  /* Sticks directly under the header so the controls stay reachable while the
     content scrolls — the header owns top: 0, this owns the next band down. */
  .demo-banner {
    position: sticky;
    top: var(--header-height);
    z-index: calc(var(--z-sticky) - 1);
    background-color: var(--bg);
    border-bottom: 1px solid var(--ui);
  }

  .demo-banner-content {
    margin: 0 auto;
    padding: var(--space-2) var(--space-4);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    min-height: 2.75rem;
    flex-wrap: wrap;
  }

  .demo-main {
    flex: 1;
    width: 100%;
    min-width: 0;
  }

  /* See the `fillHeight` prop. Scoped to the opt-in class so document-scrolling
     demos keep their normal block flow. */
  .ui-demo-layout.fill-height {
    height: 100vh;
    min-height: 0;
    overflow: hidden;
  }

  .ui-demo-layout.fill-height .demo-main {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
</style>
