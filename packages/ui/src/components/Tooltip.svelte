<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Tooltip text. For rich content, use the `tip` snippet instead. */
    text?: string;
    /** Rich tooltip content (takes precedence over `text`). */
    tip?: Snippet;
    /** The trigger element the tooltip describes. */
    children: Snippet;
    position?: 'top' | 'bottom' | 'left' | 'right';
    /** Delay in ms before the tooltip appears on hover. */
    delay?: number;
    class?: string;
  }

  let {
    text,
    tip,
    children,
    position = 'top',
    delay = 100,
    class: className = '',
  }: Props = $props();

  let visible = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tooltipId = `tooltip-${Math.random().toString(36).slice(2, 9)}`;

  function show() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      visible = true;
    }, delay);
  }

  function hide() {
    clearTimeout(timer);
    visible = false;
  }
</script>

<!-- Shows on hover and on keyboard focus; aria-describedby ties it to the trigger. -->
<span
  class="ui-tooltip {className}"
  onmouseenter={show}
  onmouseleave={hide}
  onfocusin={show}
  onfocusout={hide}
  aria-describedby={visible ? tooltipId : undefined}
>
  {@render children()}
  {#if visible}
    <span class="tooltip-bubble pos-{position}" role="tooltip" id={tooltipId}>
      {#if tip}{@render tip()}{:else}{text}{/if}
    </span>
  {/if}
</span>

<style>
  .ui-tooltip {
    position: relative;
    display: inline-flex;
  }

  .tooltip-bubble {
    position: absolute;
    z-index: var(--z-tooltip, 1600);
    width: max-content;
    max-width: 16rem;
    padding: 0.375rem 0.5rem;
    background: var(--bg-3);
    color: var(--tx);
    border: 1px solid var(--ui);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-default);
    font-family: var(--font-ui);
    font-size: var(--text-ui, 0.75rem);
    line-height: 1.4;
    text-transform: none;
    letter-spacing: normal;
    white-space: normal;
    pointer-events: none;
    animation: tooltip-in var(--transition-fast, 100ms) ease;
  }

  .pos-top {
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
  }
  .pos-bottom {
    top: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
  }
  .pos-left {
    right: calc(100% + 6px);
    top: 50%;
    transform: translateY(-50%);
  }
  .pos-right {
    left: calc(100% + 6px);
    top: 50%;
    transform: translateY(-50%);
  }

  @keyframes tooltip-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tooltip-bubble {
      animation: none;
    }
  }
</style>
