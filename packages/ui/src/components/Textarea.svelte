<script lang="ts">
  import type { HTMLTextareaAttributes } from 'svelte/elements';

  interface Props extends Omit<HTMLTextareaAttributes, 'value'> {
    value?: string | undefined;
    label?: string;
    error?: string;
    hint?: string;
    resize?: 'none' | 'vertical' | 'horizontal' | 'both';
    minRows?: number;
    maxRows?: number;
  }

  let {
    value = $bindable(),
    label,
    error,
    hint,
    resize = 'vertical',
    minRows = 3,
    maxRows,
    id,
    class: className = '',
    ...rest
  }: Props = $props();

  const textareaValue = $derived(value ?? '');

  // Generate a stable random ID once, then derive the actual ID from props
  const randomId = `textarea-${Math.random().toString(36).slice(2, 9)}`;
  const textareaId = $derived(id || randomId);

  // Calculate line height for row-based sizing
  const lineHeight = 1.5;
  const paddingY = 0.5; // rem
  const minHeight = $derived(`calc(${minRows * lineHeight}em + ${paddingY * 2}rem + 2px)`);
  const maxHeight = $derived(maxRows ? `calc(${maxRows * lineHeight}em + ${paddingY * 2}rem + 2px)` : 'none');
</script>

<div class="ui-textarea-wrapper {className}">
  {#if label}
    <label for={textareaId} class="field-label">
      {label}
    </label>
  {/if}
  <textarea
    id={textareaId}
    value={textareaValue}
    oninput={(e) => { value = e.currentTarget.value; }}
    class="field-textarea"
    class:error
    style="min-height: {minHeight}; max-height: {maxHeight}; resize: {resize};"
    {...rest}
  ></textarea>
  {#if error}
    <span class="field-message error">{error}</span>
  {:else if hint}
    <span class="field-message hint">{hint}</span>
  {/if}
</div>

<style>
  .field-label {
    display: block;
    font-family: var(--text-label-font-family);
    font-size: var(--text-label-font-size);
    font-weight: var(--text-label-font-weight);
    letter-spacing: var(--text-label-letter-spacing);
    text-transform: var(--text-label-text-transform);
    color: var(--text-label-color);
    margin-bottom: 0.5rem;
  }

  .field-textarea {
    width: 100%;
    padding: var(--component-input-padding-y) var(--component-input-padding-x);
    font-family: var(--component-input-font-family);
    font-size: var(--component-input-font-size);
    line-height: 1.5;
    color: var(--tx);
    background-color: var(--component-input-background);
    border: var(--component-input-border-width) solid var(--ui);
    border-radius: var(--component-input-border-radius);
    transition: border-color var(--transition-fast, 0.15s) ease;
    box-sizing: border-box;
  }

  .field-textarea:focus-visible {
    outline: none;
    border-color: var(--border-focus, var(--primary));
  }

  .field-textarea.error {
    border-color: var(--error);
  }

  .field-textarea.error:focus-visible {
    border-color: var(--error);
  }

  .field-textarea::placeholder {
    color: var(--tx-3);
  }

  .field-message {
    display: block;
    font-size: var(--font-size-sm, 0.75rem);
    margin-top: 0.25rem;
  }

  .field-message.error {
    color: var(--error);
  }

  .field-message.hint {
    color: var(--tx-3);
  }
</style>
