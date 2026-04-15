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
</script>

<span
  class="ui-badge variant-{variant} {className}"
  {...rest}
>
  {@render children()}
</span>

<style>
  .ui-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.375rem;
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    font-weight: 500;
    border-radius: 0.125rem;
    white-space: nowrap;
  }

  .ui-badge.variant-default {
    background-color: var(--bg-3);
    color: var(--tx);
  }

  .ui-badge.variant-success {
    background-color: var(--success-subtle);
    color: var(--success-text);
  }

  .ui-badge.variant-warning {
    background-color: var(--warning-subtle);
    color: var(--warning-text);
  }

  .ui-badge.variant-error {
    background-color: var(--error-subtle);
    color: var(--error-text);
  }

  .ui-badge.variant-info {
    background-color: var(--info-subtle);
    color: var(--info-text);
  }
</style>
