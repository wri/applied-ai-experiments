<script lang="ts">
  interface Props {
    text: string;
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    label?: string;
    successLabel?: string;
    feedbackDuration?: number;
    iconOnly?: boolean;
    class?: string;
  }

  let {
    text,
    variant = 'secondary',
    size = 'md',
    label = 'Copy',
    successLabel = 'Copied!',
    feedbackDuration = 2000,
    iconOnly = false,
    class: className = '',
  }: Props = $props();

  let copied = $state(false);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, feedbackDuration);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  // Icons as SVG paths
  const copyIcon = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
  const checkIcon = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
</script>

<button
  type="button"
  class="ui-copy-button variant-{variant} size-{size} {className}"
  class:icon-only={iconOnly}
  class:copied
  onclick={copyToClipboard}
  title={copied ? successLabel : label}
>
  <span class="copy-icon">
    {#if copied}
      {@html checkIcon}
    {:else}
      {@html copyIcon}
    {/if}
  </span>
  {#if !iconOnly}
    <span>{copied ? successLabel : label}</span>
  {/if}
</button>

<style>
  .ui-copy-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    font-family: var(--component-button-font-family);
    font-weight: var(--component-button-font-weight);
    border-radius: var(--component-button-border-radius);
    border-width: var(--component-button-border-width);
    border-style: solid;
    cursor: pointer;
    transition: all var(--transition-fast, 0.15s) ease;
  }

  /* Sizes */
  .ui-copy-button.size-sm {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    min-height: 1.75rem;
  }

  .ui-copy-button.size-sm.icon-only {
    padding: 0.25rem;
    min-width: 1.75rem;
  }

  .ui-copy-button.size-md {
    padding: 0.5rem 0.75rem;
    font-size: 0.8125rem;
    min-height: 2.25rem;
  }

  .ui-copy-button.size-md.icon-only {
    padding: 0.5rem;
    min-width: 2.25rem;
  }

  .ui-copy-button.size-lg {
    padding: 0.625rem 1rem;
    font-size: 1rem;
    min-height: 2.75rem;
  }

  .ui-copy-button.size-lg.icon-only {
    padding: 0.625rem;
    min-width: 2.75rem;
  }

  /* Variants */
  .ui-copy-button.variant-primary {
    background-color: var(--primary);
    border-color: var(--primary);
    color: var(--primary-content);
  }

  .ui-copy-button.variant-primary:hover {
    background-color: var(--primary-hover);
    border-color: var(--primary-hover);
  }

  .ui-copy-button.variant-secondary {
    background-color: transparent;
    border-color: var(--ui);
    color: var(--tx);
  }

  .ui-copy-button.variant-secondary:hover {
    background-color: var(--bg-3);
    border-color: var(--ui-2);
  }

  .ui-copy-button.variant-ghost {
    background-color: transparent;
    border-color: transparent;
    color: var(--tx-2);
  }

  .ui-copy-button.variant-ghost:hover {
    background-color: var(--bg-2);
    color: var(--tx);
  }

  /* Copied state */
  .ui-copy-button.copied {
    color: var(--success-text);
  }

  /* Focus */
  .ui-copy-button:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .copy-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
