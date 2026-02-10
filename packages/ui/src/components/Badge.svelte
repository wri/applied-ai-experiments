<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  interface Props extends HTMLAttributes<HTMLSpanElement> {
    variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
    children: Snippet;
  }

  let {
    variant = 'default',
    class: className = '',
    children,
    ...rest
  }: Props = $props();

  const variantStyles = {
    default: 'background-color: var(--bg-3); color: var(--tx);',
    success: 'background-color: var(--success-subtle); color: var(--success-text);',
    warning: 'background-color: var(--warning-subtle); color: var(--warning-text);',
    error: 'background-color: var(--error-subtle); color: var(--error-text);',
    info: 'background-color: var(--info-subtle); color: var(--info-text);',
  };
</script>

<span
  class="ui-badge {className}"
  style="
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.375rem;
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    font-weight: 500;
    border-radius: 0.125rem;
    white-space: nowrap;
    {variantStyles[variant]}
  "
  {...rest}
>
  {@render children()}
</span>
