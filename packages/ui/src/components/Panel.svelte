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

<div class="ui-panel {className}" {...rest}>
  {#if title}
    {#if collapsible}
      <button
        type="button"
        class="panel-header collapsible"
        class:collapsed
        onclick={toggle}
      >
        <span class="panel-title">
          <span class="panel-chevron" class:collapsed>&#9654;</span>
          {title}
        </span>
        {#if actions}
          <div class="panel-actions" role="presentation" onclick={(e) => e.stopPropagation()}>
            {@render actions()}
          </div>
        {/if}
      </button>
    {:else}
      <div class="panel-header">
        <span class="panel-title">{title}</span>
        {#if actions}
          <div class="panel-actions">
            {@render actions()}
          </div>
        {/if}
      </div>
    {/if}
  {/if}
  {#if !collapsed}
    <div class="panel-body">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .ui-panel {
    background-color: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: var(--border-radius-lg);
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: var(--component-panel-header-background);
    padding: var(--component-panel-header-padding);
    border-bottom: 1px solid var(--ui);
    width: 100%;
    font: inherit;
  }

  button.panel-header {
    border: none;
    cursor: pointer;
    text-align: left;
  }

  .panel-header.collapsed {
    border-bottom: none;
  }

  .panel-header:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: -2px;
  }

  .panel-title {
    font-family: var(--text-panel-title-font-family);
    font-size: var(--text-panel-title-font-size);
    font-weight: var(--text-panel-title-font-weight);
    text-transform: var(--text-panel-title-text-transform);
    color: var(--tx-2);
  }

  .panel-chevron {
    display: inline-block;
    margin-right: 0.5rem;
    transform: rotate(90deg);
    transition: transform 0.2s;
  }

  .panel-chevron.collapsed {
    transform: rotate(0deg);
  }

  .panel-body {
    padding: var(--component-panel-body-padding);
  }
</style>
