<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  interface Props extends Omit<HTMLInputAttributes, 'value'> {
    value?: string | undefined;
    label?: string;
    error?: string;
    hint?: string;
  }

  let {
    value = $bindable(),
    label,
    error,
    hint,
    id,
    class: className = '',
    ...rest
  }: Props = $props();

  // Ensure value is always a string for the input
  const inputValue = $derived(value ?? '');

  // Generate a stable random ID once, then derive the actual ID from props
  const randomId = `input-${Math.random().toString(36).slice(2, 9)}`;
  const inputId = $derived(id || randomId);
</script>

<div class="ui-input-wrapper {className}">
  {#if label}
    <label for={inputId} class="field-label">
      {label}
    </label>
  {/if}
  <input
    {id}
    value={inputValue}
    oninput={(e) => { value = e.currentTarget.value; }}
    class="field-input"
    class:error
    {...rest}
  />
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

  .field-input {
    width: 100%;
    padding: var(--component-input-padding-y) var(--component-input-padding-x);
    font-family: var(--component-input-font-family);
    font-size: var(--component-input-font-size);
    line-height: var(--component-input-line-height);
    color: var(--tx);
    background-color: var(--component-input-background);
    border: var(--component-input-border-width) solid var(--ui);
    border-radius: var(--component-input-border-radius);
    min-height: var(--component-input-min-height);
    transition: border-color var(--transition-fast, 0.15s) ease;
    box-sizing: border-box;
  }

  .field-input:focus-visible {
    outline: none;
    border-color: var(--border-focus, var(--primary));
  }

  .field-input.error {
    border-color: var(--error);
  }

  .field-input.error:focus-visible {
    border-color: var(--error);
  }

  .field-input::placeholder {
    color: var(--tx-3);
  }

  .field-message {
    display: block;
    font-size: var(--font-size-sm);
    margin-top: 0.25rem;
  }

  .field-message.error {
    color: var(--error);
  }

  .field-message.hint {
    color: var(--tx-3);
  }
</style>
