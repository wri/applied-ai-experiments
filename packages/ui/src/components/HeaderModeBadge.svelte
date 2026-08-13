<script lang="ts">
  /**
   * The live/mock indicator that leads a demo header's right-hand cluster.
   *
   * Standardised from the ai-web-map-exploration header (DESIGN.md §4): a demo
   * that can run without a key says so in the chrome rather than burying it in
   * settings, so nobody mistakes synthetic output for a real model response.
   */
  interface Props {
    /** 'mock' renders neutral; 'live' renders in the accent colour. */
    mode: 'mock' | 'live';
    /** Badge text — conventionally the model id when live, "mock" when not. */
    label?: string;
    /**
     * Tooltip override. Needed by demos whose keyless state isn't a mock at all
     * (mcp-web-map just can't run) — the default copy would claim canned
     * responses exist.
     */
    hint?: string;
    /** Click target. Conventionally opens the demo's settings/keys surface. */
    onclick?: () => void;
    class?: string;
  }

  let { mode, label, hint, onclick, class: className = '' }: Props = $props();

  const text = $derived(label ?? (mode === 'mock' ? 'mock' : 'live'));
  const tooltip = $derived(
    hint ??
      (mode === 'mock'
        ? 'Running on canned responses — add an API key for live calls'
        : `Running live on ${text}`),
  );
</script>

{#if onclick}
  <button
    type="button"
    class="ui-header-mode mode-{mode} {className}"
    title={tooltip}
    aria-label={tooltip}
    {onclick}
  >{text}</button>
{:else}
  <span class="ui-header-mode mode-{mode} {className}" title={tooltip}>{text}</span>
{/if}

<style>
  .ui-header-mode {
    display: inline-flex;
    align-items: center;
    height: 2rem;
    padding: 0 0.5rem;
    border: 1px solid var(--ui);
    border-radius: var(--radius-sm);
    background-color: var(--bg);
    font-family: var(--font-mono);
    font-size: var(--text-badge);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
    color: var(--tx-2);
    transition: all var(--transition-fast, 100ms) ease;
  }

  .ui-header-mode.mode-live {
    border-color: var(--primary);
    color: var(--primary);
  }

  button.ui-header-mode {
    cursor: pointer;
  }

  button.ui-header-mode:hover {
    border-color: var(--ui-2);
    color: var(--tx);
  }

  button.ui-header-mode.mode-live:hover {
    border-color: var(--primary-hover, var(--primary));
    color: var(--primary-hover, var(--primary));
  }

  button.ui-header-mode:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
</style>
