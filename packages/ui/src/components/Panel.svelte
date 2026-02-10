<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  interface Props extends HTMLAttributes<HTMLDivElement> {
    title?: string;
    collapsible?: boolean;
    collapsed?: boolean;
    children: Snippet;
    actions?: Snippet;
  }

  let {
    title,
    collapsible = false,
    collapsed = $bindable(false),
    class: className = '',
    children,
    actions,
    ...rest
  }: Props = $props();

  function toggle() {
    if (collapsible) {
      collapsed = !collapsed;
    }
  }
</script>

<div
  class="ui-panel {className}"
  style="
    background-color: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: var(--border-radius-lg);
    overflow: hidden;
  "
  {...rest}
>
  {#if title}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="panel-header"
      style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        background-color: var(--component-panel-header-background);
        padding: var(--component-panel-header-padding);
        border-bottom: {collapsed ? 'none' : '1px solid var(--ui)'};
        cursor: {collapsible ? 'pointer' : 'default'};
      "
      onclick={toggle}
      onkeydown={(e) => e.key === 'Enter' && toggle()}
      role={collapsible ? 'button' : undefined}
      tabindex={collapsible ? 0 : undefined}
    >
      <span
        style="
          font-family: var(--text-panel-title-font-family);
          font-size: var(--text-panel-title-font-size);
          font-weight: var(--text-panel-title-font-weight);
          text-transform: var(--text-panel-title-text-transform);
          color: var(--tx-2);
        "
      >
        {#if collapsible}
          <span style="margin-right: 0.5rem; display: inline-block; transform: rotate({collapsed ? '0deg' : '90deg'}); transition: transform 0.2s;">&#9654;</span>
        {/if}
        {title}
      </span>
      {#if actions}
        <div class="panel-actions" role="presentation" onclick={(e) => e.stopPropagation()}>
          {@render actions()}
        </div>
      {/if}
    </div>
  {/if}
  {#if !collapsed}
    <div
      class="panel-body"
      style="padding: var(--component-panel-body-padding);"
    >
      {@render children()}
    </div>
  {/if}
</div>
