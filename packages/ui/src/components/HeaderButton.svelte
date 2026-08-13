<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    /**
     * 'icon': 2rem square, children is an SVG icon.
     * 'text': text label in mono UI type (no text-transform — author sentence case).
     */
    variant?: 'icon' | 'text';
    /** Accessible name (sentence case); rendered as aria-label and title. */
    label: string;
    /** Pressed/toggled visual state. */
    active?: boolean;
    children: Snippet;
    class?: string;
  }

  let {
    variant = 'icon',
    label,
    active = false,
    children,
    class: className = '',
    ...rest
  }: Props = $props();
</script>

<button
  type="button"
  class="ui-header-button variant-{variant} {className}"
  class:active
  aria-label={label}
  aria-pressed={active}
  title={label}
  {...rest}
>
  {@render children()}
</button>

<style>
  .ui-header-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    height: 2rem;
    border: 1px solid var(--ui);
    border-radius: var(--radius-sm);
    background-color: var(--bg);
    color: var(--tx-2);
    cursor: pointer;
    transition: all var(--transition-fast, 100ms) ease;
  }

  .ui-header-button.variant-icon {
    width: 2rem;
    padding: 0;
  }

  .ui-header-button.variant-text {
    padding: 0 0.5rem;
    font-family: var(--font-mono);
    font-size: var(--text-ui);
    font-weight: 500;
  }

  .ui-header-button:hover {
    border-color: var(--ui-2);
    color: var(--tx);
  }

  .ui-header-button.active {
    border-color: var(--primary);
    background-color: var(--bg-3);
    color: var(--tx);
  }

  .ui-header-button:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
</style>
