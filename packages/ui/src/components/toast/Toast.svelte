<script lang="ts">
  import type { Toast } from './toastStore';

  interface Props {
    toast: Toast;
    onclose?: () => void;
  }

  let { toast: toastData, onclose }: Props = $props();

  const variantStyles = {
    info: {
      bg: 'var(--info-subtle)',
      border: 'var(--info)',
      text: 'var(--info-text)',
      icon: '\u2139',
    },
    success: {
      bg: 'var(--success-subtle)',
      border: 'var(--success)',
      text: 'var(--success-text)',
      icon: '\u2713',
    },
    warning: {
      bg: 'var(--warning-subtle)',
      border: 'var(--warning)',
      text: 'var(--warning-text)',
      icon: '\u26A0',
    },
    error: {
      bg: 'var(--error-subtle)',
      border: 'var(--error)',
      text: 'var(--error-text)',
      icon: '\u2717',
    },
  };

  const styles = $derived(variantStyles[toastData.variant]);
</script>

<div
  class="ui-toast"
  role="alert"
  style="
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: {styles.bg};
    border: 1px solid {styles.border};
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-default);
    min-width: 300px;
    max-width: 400px;
    animation: slideIn 0.2s ease-out;
  "
>
  <span style="font-size: 1.25rem; line-height: 1; color: {styles.text};">
    {styles.icon}
  </span>

  <div style="flex: 1; min-width: 0;">
    <p style="
      margin: 0;
      font-family: var(--font-ui);
      font-size: var(--text-body-font-size);
      color: {styles.text};
      line-height: 1.4;
    ">
      {toastData.message}
    </p>

    {#if toastData.action}
      <button
        type="button"
        onclick={() => {
          toastData.action?.onclick();
          onclose?.();
        }}
        style="
          margin-top: 0.5rem;
          padding: 0.25rem 0.5rem;
          font-family: var(--font-ui);
          font-size: 0.75rem;
          font-weight: 500;
          color: {styles.text};
          background: transparent;
          border: 1px solid {styles.border};
          border-radius: var(--radius-sm);
          cursor: pointer;
        "
      >
        {toastData.action.label}
      </button>
    {/if}
  </div>

  {#if toastData.dismissible}
    <button
      type="button"
      onclick={onclose}
      style="
        background: none;
        border: none;
        cursor: pointer;
        color: {styles.text};
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

<style>
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
</style>
