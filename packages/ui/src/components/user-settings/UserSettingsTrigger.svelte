<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    variant?: 'icon' | 'icon-label';
    active?: boolean;
    class?: string;
  }

  let {
    variant = 'icon',
    active = false,
    class: className = '',
    ...rest
  }: Props = $props();

  const baseStyles = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-weight: 500;
    border-radius: var(--radius-md);
    border: 1px solid transparent;
    cursor: pointer;
    transition: all var(--transition-fast) ease;
    background-color: transparent;
    color: var(--tx-2);
  `;

  const sizeStyles = {
    icon: 'padding: 0.5rem; min-width: 2.25rem; min-height: 2.25rem;',
    'icon-label': 'padding: 0.5rem 0.75rem;',
  };

  const activeStyles = `
    background-color: var(--bg-3);
    border-color: var(--ui);
    color: var(--tx);
  `;

  const hoverStyles = `
    background-color: var(--bg-2);
    border-color: var(--ui);
    color: var(--tx);
  `;
</script>

<button
  type="button"
  class="ui-user-settings-trigger {className}"
  aria-label="User settings"
  aria-expanded={active}
  style="{baseStyles} {sizeStyles[variant]} {active ? activeStyles : ''}"
  onmouseenter={(e) => {
    if (!active) {
      e.currentTarget.style.cssText += hoverStyles;
    }
  }}
  onmouseleave={(e) => {
    if (!active) {
      e.currentTarget.style.cssText = `${baseStyles} ${sizeStyles[variant]}`;
    }
  }}
  {...rest}
>
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
  {#if variant === 'icon-label'}
    <span>Settings</span>
  {/if}
</button>
