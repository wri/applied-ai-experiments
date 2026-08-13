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
</script>

<div
  class="ui-card padding-{padding} {className}"
  {...rest}
>
  {@render children()}
</div>

<style>
  .ui-card {
    background-color: var(--card-background);
    border: var(--component-card-border-width) solid var(--card-border-color);
    border-radius: var(--component-card-border-radius);
    box-shadow: var(--component-card-shadow);
  }

  .ui-card.padding-sm {
    padding: var(--component-card-padding-sm);
  }

  .ui-card.padding-md {
    padding: var(--component-card-padding);
  }

  .ui-card.padding-lg {
    padding: var(--component-card-padding-lg);
  }
</style>
