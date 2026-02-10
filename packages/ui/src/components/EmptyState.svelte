<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    description?: string;
    icon?: string;
    children?: Snippet;
    class?: string;
  }

  let {
    title,
    description,
    icon,
    children,
    class: className = '',
  }: Props = $props();
</script>

<div
  class="ui-empty-state {className}"
  style="
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-8);
    text-align: center;
    min-height: 200px;
  "
>
  {#if icon}
    <div
      class="empty-icon"
      style="
        font-size: 2.5rem;
        line-height: 1;
        margin-bottom: var(--space-4);
        opacity: 0.5;
      "
      aria-hidden="true"
    >
      {icon}
    </div>
  {:else}
    <div
      class="empty-icon-default"
      style="
        width: 3rem;
        height: 3rem;
        margin-bottom: var(--space-4);
        border: 2px dashed var(--ui);
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--tx-3);
      "
      aria-hidden="true"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
  {/if}

  <h3
    class="empty-title"
    style="
      font-family: var(--font-mono);
      font-size: var(--text-title-md);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--tx);
      margin: 0 0 var(--space-2) 0;
    "
  >
    {title}
  </h3>

  {#if description}
    <p
      class="empty-description"
      style="
        font-family: var(--font-body);
        font-size: var(--text-body-font-size);
        color: var(--tx-2);
        margin: 0 0 var(--space-4) 0;
        max-width: 24rem;
      "
    >
      {description}
    </p>
  {/if}

  {#if children}
    <div class="empty-actions" style="margin-top: var(--space-2);">
      {@render children()}
    </div>
  {/if}
</div>
