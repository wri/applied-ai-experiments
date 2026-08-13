<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { BYOKStores } from '@byo-keys/svelte';
  import type { ProviderId } from '@byo-keys/core';
  import UserSettings from './user-settings/UserSettings.svelte';
  import ThemeSwitcher from './ThemeSwitcher.svelte';
  import DemoInfoButton from './DemoInfoButton.svelte';
  import HeaderModeBadge from './HeaderModeBadge.svelte';

  /**
   * The one demo header shape (DESIGN.md §4), standardised from
   * ai-web-map-exploration:
   *
   *   Applied AI Experiments / Title            [mode] [info] [actions] [theme] [keys]
   *
   * Deliberately no subtitle — the tagline was a second competing title at a
   * size that read as neither. What the demo is now lives behind the info
   * button, sourced from the experiment's brief description.
   *
   * `actions` is for demo chrome only (session telemetry, an engine toggle).
   * Anything with its own label — view tabs, export buttons, mode switches —
   * belongs in DemoLayout's `banner` row beneath the header, not crammed in
   * here.
   */
  interface Props {
    title: string;
    /** Info-modal body. Defaults to the app.html meta description (from the brief). */
    description?: string;
    /** Link to this experiment's hub detail page, surfaced in the info modal. */
    infoHref?: string;
    /**
     * Where the "Applied AI Experiments" prefix links — the hub homepage. Pass
     * `hubHomeHref(base)` with `base` from `$app/paths`. Omit it and the prefix
     * renders as plain text, so a demo served outside the hub has no dead link.
     */
    homeHref?: string;
    /** Renders the info button. On by default — every demo should explain itself. */
    showInfo?: boolean;
    /** Live/mock indicator. Omit entirely for demos that make no model calls. */
    mode?: 'mock' | 'live';
    /** Badge text — conventionally the model id when live, "mock" when not. */
    modeLabel?: string;
    /** Tooltip override for the mode badge. */
    modeHint?: string;
    /**
     * Click handler for the mode badge. Defaults to opening this header's own
     * keys/settings popover — "mock" is almost always a prompt to add a key,
     * so the badge should lead there without the demo wiring it up.
     */
    onModeClick?: () => void;
    stores?: BYOKStores;
    providers?: ProviderId[];
    showSettings?: boolean;
    showTheme?: boolean;
    showApiKeys?: boolean;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    /** DemoLayout exposes this as `headerActions`. */
    actions?: Snippet;
    class?: string;
  }

  let {
    title,
    description,
    infoHref,
    homeHref,
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
    maxWidth = 'lg',
    actions,
    class: className = '',
  }: Props = $props();

  const maxWidthStyles = {
    sm: 'max-width: 640px;',
    md: 'max-width: 768px;',
    lg: 'max-width: 1024px;',
    xl: 'max-width: var(--max-width, 1200px);',
    full: 'max-width: 100%;',
  };

  const hasSettings = $derived(showSettings && showApiKeys && !!stores);
  let settingsOpen = $state(false);

  // Only clickable when there's somewhere for the click to go.
  const modeClick = $derived(
    onModeClick ?? (hasSettings ? () => (settingsOpen = true) : undefined),
  );
</script>

<header class="ui-demo-header {className}">
  <div class="header-content" style={maxWidthStyles[maxWidth]}>
    <div class="brand">
      {#if homeHref}
        <a class="brand-prefix brand-home" href={homeHref}>Applied AI Experiments</a>
      {:else}
        <span class="brand-prefix">Applied AI Experiments</span>
      {/if}
      <span class="brand-sep">/</span>
      <span class="brand-title">{title}</span>
    </div>

    <div class="header-actions">
      {#if mode}
        <HeaderModeBadge {mode} label={modeLabel} hint={modeHint} onclick={modeClick} />
      {/if}

      {#if showInfo}
        <DemoInfoButton {title} {description} href={infoHref} />
      {/if}

      {#if actions}
        {@render actions()}
      {/if}

      {#if showTheme}
        <ThemeSwitcher />
      {/if}

      {#if hasSettings}
        <UserSettings
          stores={stores!}
          {providers}
          showTheme={false}
          {showApiKeys}
          position="bottom-right"
          bind:open={settingsOpen}
        />
      {/if}
    </div>
  </div>
</header>

<style>
  .ui-demo-header {
    background-color: var(--bg-2);
    border-bottom: 1px solid var(--ui);
    position: sticky;
    top: 0;
    z-index: var(--z-sticky);
  }

  .header-content {
    margin: 0 auto;
    padding: 0 var(--space-4);
    height: var(--header-height);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  /* Standard demo header title treatment (DESIGN.md §4) */
  .brand {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    min-width: 0;
    font-family: var(--font-mono);
    font-size: var(--text-title-md);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
    overflow: hidden;
  }

  .brand-prefix {
    color: var(--tx-2);
  }

  /* Reads as part of the breadcrumb, not as a styled link — the underline on
     hover is the whole affordance. */
  .brand-home {
    text-decoration: none;
    color: inherit;
    border-radius: var(--radius-sm);
  }

  .brand-home:hover {
    color: var(--tx);
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }

  .brand-home:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .brand-sep {
    color: var(--tx-3);
  }

  .brand-title {
    color: var(--tx);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  /* Narrow viewports: the prefix is context, the experiment name is the point. */
  @media (max-width: 640px) {
    .brand-prefix,
    .brand-sep {
      display: none;
    }
  }
</style>
