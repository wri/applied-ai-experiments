<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    style?: string;
    children: Snippet;
  }

  let {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    class: className = '',
    style: customStyle = '',
    children,
    ...rest
  }: Props = $props();

  const baseStyles = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--component-button-gap);
    font-family: var(--component-button-font-family);
    font-weight: var(--component-button-font-weight);
    font-size: var(--component-button-font-size);
    line-height: var(--component-button-line-height);
    border-radius: var(--component-button-border-radius);
    border-width: var(--component-button-border-width);
    border-style: solid;
    cursor: pointer;
    transition: all var(--transition-fast) ease;
    text-decoration: none;
  `;

  const sizeStyles = {
    sm: 'padding: 0.25rem 0.5rem; font-size: 0.75rem; min-height: 1.75rem;',
    md: 'padding: var(--component-button-padding-y) var(--component-button-padding-x); min-height: var(--component-button-min-height);',
    lg: 'padding: 0.75rem 1.5rem; font-size: 1rem; min-height: 3rem;',
  };

  const variantStyles = {
    primary: `
      background-color: var(--primary);
      border-color: var(--primary);
      color: var(--primary-content);
    `,
    secondary: `
      background-color: transparent;
      border-color: var(--ui);
      color: var(--tx);
    `,
    ghost: `
      background-color: transparent;
      border-color: transparent;
      color: var(--tx);
    `,
    danger: `
      background-color: var(--error);
      border-color: var(--error);
      color: var(--primary-content);
    `,
  };

  const hoverStyles = {
    primary: 'background-color: var(--primary-hover); border-color: var(--primary-hover);',
    secondary: 'background-color: var(--bg-3); border-color: var(--ui-2);',
    ghost: 'background-color: var(--bg-2);',
    danger: 'background-color: var(--interactive-destructive-hover); border-color: var(--interactive-destructive-hover);',
  };

  const disabledStyles = `
    opacity: 0.5;
    cursor: not-allowed;
  `;
</script>

<button
  class="ui-button {className}"
  class:loading
  disabled={disabled || loading}
  style="{baseStyles} {sizeStyles[size]} {variantStyles[variant]} {disabled || loading ? disabledStyles : ''} {customStyle}"
  onmouseenter={(e) => {
    if (!disabled && !loading) {
      e.currentTarget.style.cssText += hoverStyles[variant];
    }
  }}
  onmouseleave={(e) => {
    if (!disabled && !loading) {
      e.currentTarget.style.cssText = `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${customStyle}`;
    }
  }}
  {...rest}
>
  {#if loading}
    <span class="spinner" style="width: 1em; height: 1em; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite;"></span>
  {/if}
  {@render children()}
</button>

<style>
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
