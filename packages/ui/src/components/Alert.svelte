<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'info' | 'success' | 'warning' | 'error';
    dismissible?: boolean;
    ondismiss?: () => void;
    children: Snippet;
    title?: Snippet;
    class?: string;
  }

  let {
    variant = 'info',
    dismissible = false,
    ondismiss,
    class: className = '',
    children,
    title,
  }: Props = $props();

  let visible = $state(true);

  const variantStyles = {
    info: 'background-color: var(--info-subtle); border-color: var(--info); color: var(--info-text);',
    success: 'background-color: var(--success-subtle); border-color: var(--success); color: var(--success-text);',
    warning: 'background-color: var(--warning-subtle); border-color: var(--warning); color: var(--warning-text);',
    error: 'background-color: var(--error-subtle); border-color: var(--error); color: var(--error-text);',
  };

  const icons = {
    info: '\u2139',
    success: '\u2713',
    warning: '\u26A0',
    error: '\u2717',
  };

  function dismiss() {
    visible = false;
    ondismiss?.();
  }
</script>

{#if visible}
  <div
    class="ui-alert {className}"
    role="alert"
    style="
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius-md);
      border-left: 3px solid;
      {variantStyles[variant]}
    "
  >
    <span style="font-size: 1.25rem; line-height: 1;">{icons[variant]}</span>
    <div style="flex: 1; min-width: 0;">
      {#if title}
        <div style="font-weight: 600; margin-bottom: 0.25rem;">
          {@render title()}
        </div>
      {/if}
      <div style="font-size: var(--font-size-sm);">
        {@render children()}
      </div>
    </div>
    {#if dismissible}
      <button
        type="button"
        onclick={dismiss}
        style="
          background: none;
          border: none;
          cursor: pointer;
          color: inherit;
          font-size: 1.25rem;
          line-height: 1;
          opacity: 0.7;
          padding: 0;
        "
        aria-label="Dismiss"
      >
        &times;
      </button>
    {/if}
  </div>
{/if}
