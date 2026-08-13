<script lang="ts">
  interface Option {
    value: string;
    label: string;
    disabled?: boolean;
  }

  interface Props {
    value?: string;
    options: Option[];
    label?: string;
    error?: string;
    hint?: string;
    placeholder?: string;
    disabled?: boolean;
    id?: string;
    class?: string;
    onchange?: (value: string) => void;
  }

  let {
    value = $bindable(''),
    options,
    label,
    error,
    hint,
    placeholder,
    disabled = false,
    id,
    class: className = '',
    onchange,
  }: Props = $props();

  // Generate a stable random ID once, then derive the actual ID from props
  const randomId = `select-${Math.random().toString(36).slice(2, 9)}`;
  const selectId = $derived(id || randomId);

  function handleChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    value = target.value;
    onchange?.(value);
  }
</script>

<div class="ui-select-wrapper {className}">
  {#if label}
    <label for={selectId} class="field-label">
      {label}
    </label>
  {/if}
  <div class="select-container">
    <select
      id={selectId}
      {value}
      {disabled}
      onchange={handleChange}
      class="field-select"
      class:error
    >
      {#if placeholder}
        <option value="" disabled selected={!value}>{placeholder}</option>
      {/if}
      {#each options as option}
        <option value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      {/each}
    </select>
    <span class="select-arrow">&#9662;</span>
  </div>
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

  .select-container {
    position: relative;
  }

  .field-select {
    width: 100%;
    padding: var(--component-input-padding-y) var(--component-input-padding-x);
    padding-right: 2.5rem;
    font-family: var(--component-input-font-family);
    font-size: var(--component-input-font-size);
    line-height: var(--component-input-line-height);
    color: var(--tx);
    background-color: var(--component-input-background);
    border: var(--component-input-border-width) solid var(--ui);
    border-radius: var(--component-input-border-radius);
    min-height: var(--component-input-min-height);
    appearance: none;
    cursor: pointer;
    transition: border-color var(--transition-fast, 0.15s) ease;
    box-sizing: border-box;
  }

  .field-select:focus-visible {
    outline: none;
    border-color: var(--border-focus, var(--primary));
  }

  .field-select.error {
    border-color: var(--error);
  }

  .field-select.error:focus-visible {
    border-color: var(--error);
  }

  .field-select option {
    background-color: var(--bg-2);
    color: var(--tx);
  }

  .select-arrow {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: var(--tx-2);
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
