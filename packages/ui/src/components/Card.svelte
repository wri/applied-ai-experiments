<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  interface Props extends HTMLAttributes<HTMLDivElement> {
    padding?: 'sm' | 'md' | 'lg';
    children: Snippet;
  }

  let {
    padding = 'md',
    class: className = '',
    children,
    ...rest
  }: Props = $props();

  const paddingMap = {
    sm: 'var(--component-card-padding-sm)',
    md: 'var(--component-card-padding)',
    lg: 'var(--component-card-padding-lg)',
  };
</script>

<div
  class="ui-card {className}"
  style="
    background-color: var(--card-background);
    border: var(--component-card-border-width) solid var(--card-border-color);
    border-radius: var(--component-card-border-radius);
    padding: {paddingMap[padding]};
    box-shadow: var(--component-card-shadow);
  "
  {...rest}
>
  {@render children()}
</div>
