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
    class="ui-alert variant-{variant} {className}"
    role="alert"
  >
    <span class="alert-icon">{icons[variant]}</span>
    <div class="alert-content">
      {#if title}
        <div class="alert-title">
          {@render title()}
        </div>
      {/if}
      <div class="alert-body">
        {@render children()}
      </div>
    </div>
    {#if dismissible}
      <button
        type="button"
        class="alert-dismiss"
        onclick={dismiss}
        aria-label="Dismiss"
      >
        &times;
      </button>
    {/if}
  </div>
{/if}

<style>
  .ui-alert {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    border-left: 3px solid;
  }

  .ui-alert.variant-info {
    background-color: var(--info-subtle);
    border-color: var(--info);
    color: var(--info-text);
  }

  .ui-alert.variant-success {
    background-color: var(--success-subtle);
    border-color: var(--success);
    color: var(--success-text);
  }

  .ui-alert.variant-warning {
    background-color: var(--warning-subtle);
    border-color: var(--warning);
    color: var(--warning-text);
  }

  .ui-alert.variant-error {
    background-color: var(--error-subtle);
    border-color: var(--error);
    color: var(--error-text);
  }

  .alert-icon {
    font-size: 1.25rem;
    line-height: 1;
  }

  .alert-content {
    flex: 1;
    min-width: 0;
  }

  .alert-title {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .alert-body {
    font-size: var(--font-size-sm);
  }

  .alert-dismiss {
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    font-size: 1.25rem;
    line-height: 1;
    opacity: 0.7;
    padding: 0;
  }

  .alert-dismiss:hover {
    opacity: 1;
  }
</style>
