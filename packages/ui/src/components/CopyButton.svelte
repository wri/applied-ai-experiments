<script lang="ts">
  interface Props {
    text: string;
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    label?: string;
    successLabel?: string;
    feedbackDuration?: number;
    iconOnly?: boolean;
    class?: string;
  }

  let {
    text,
    variant = 'secondary',
    size = 'md',
    label = 'Copy',
    successLabel = 'Copied!',
    feedbackDuration = 2000,
    iconOnly = false,
    class: className = '',
  }: Props = $props();

  let copied = $state(false);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, feedbackDuration);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  const baseStyles = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    font-family: var(--component-button-font-family);
    font-weight: var(--component-button-font-weight);
    border-radius: var(--component-button-border-radius);
    border-width: var(--component-button-border-width);
    border-style: solid;
    cursor: pointer;
    transition: all var(--transition-fast) ease;
  `;

  const sizeStyles = $derived({
    sm: iconOnly
      ? 'padding: 0.25rem; font-size: 0.75rem; min-height: 1.75rem; min-width: 1.75rem;'
      : 'padding: 0.25rem 0.5rem; font-size: 0.75rem; min-height: 1.75rem;',
    md: iconOnly
      ? 'padding: 0.5rem; font-size: 0.8125rem; min-height: 2.25rem; min-width: 2.25rem;'
      : 'padding: 0.5rem 0.75rem; font-size: 0.8125rem; min-height: 2.25rem;',
    lg: iconOnly
      ? 'padding: 0.625rem; font-size: 1rem; min-height: 2.75rem; min-width: 2.75rem;'
      : 'padding: 0.625rem 1rem; font-size: 1rem; min-height: 2.75rem;',
  });

  const variantStyles = {
    primary: `
      background-color: var(--primary);
      border-color: var(--primary);
      color: var(--primary-content);
    `,
    secondary: `
      background-color: transparent;
      border-color: var(--ui);
      color: var(--tx);
    `,
    ghost: `
      background-color: transparent;
      border-color: transparent;
      color: var(--tx-2);
    `,
  };

  const hoverStyles = {
    primary: 'background-color: var(--primary-hover); border-color: var(--primary-hover);',
    secondary: 'background-color: var(--bg-3); border-color: var(--ui-2);',
    ghost: 'background-color: var(--bg-2); color: var(--tx);',
  };

  // Icons as SVG paths
  const copyIcon = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
  const checkIcon = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
</script>

<button
  type="button"
  class="ui-copy-button {className}"
  onclick={copyToClipboard}
  style="{baseStyles} {sizeStyles[size]} {variantStyles[variant]} {copied ? 'color: var(--success-text);' : ''}"
  onmouseenter={(e) => {
    if (!copied) {
      e.currentTarget.style.cssText += hoverStyles[variant];
    }
  }}
  onmouseleave={(e) => {
    e.currentTarget.style.cssText = `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${copied ? 'color: var(--success-text);' : ''}`;
  }}
  title={copied ? successLabel : label}
>
  <span style="display: flex; align-items: center; justify-content: center;">
    {#if copied}
      {@html checkIcon}
    {:else}
      {@html copyIcon}
    {/if}
  </span>
  {#if !iconOnly}
    <span>{copied ? successLabel : label}</span>
  {/if}
</button>
