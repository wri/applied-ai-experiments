<script lang="ts">
  interface Props {
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    class?: string;
    onchange?: (value: string) => void;
    oninput?: (value: string) => void;
    onclear?: () => void;
  }

  let {
    value = $bindable(''),
    placeholder = 'Search...',
    disabled = false,
    class: className = '',
    onchange,
    oninput,
    onclear,
  }: Props = $props();

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    value = target.value;
    oninput?.(value);
  }

  function handleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    value = target.value;
    onchange?.(value);
  }

  function handleClear() {
    value = '';
    onclear?.();
    oninput?.('');
    onchange?.('');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && value) {
      handleClear();
      event.preventDefault();
    }
  }
</script>

<div
  class="ui-search-input {className}"
  style="
    position: relative;
    display: flex;
    align-items: center;
  "
>
  <div
    class="search-icon"
    style="
      position: absolute;
      left: var(--space-3);
      color: var(--tx-3);
      pointer-events: none;
      display: flex;
      align-items: center;
    "
    aria-hidden="true"
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M11 11L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  </div>

  <input
    type="search"
    {value}
    {placeholder}
    {disabled}
    oninput={handleInput}
    onchange={handleChange}
    onkeydown={handleKeydown}
    style="
      width: 100%;
      height: var(--component-input-min-height);
      padding: var(--component-input-padding-y) var(--space-8) var(--component-input-padding-y) calc(var(--space-3) + 16px + var(--space-2));
      font-family: var(--component-input-font-family);
      font-size: var(--component-input-font-size);
      line-height: var(--component-input-line-height);
      color: var(--tx);
      background-color: var(--component-input-background);
      border: var(--component-input-border-width) solid var(--ui);
      border-radius: var(--component-input-border-radius);
      outline: none;
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    "
    class:disabled
  />

  {#if value}
    <button
      type="button"
      class="search-clear"
      onclick={handleClear}
      style="
        position: absolute;
        right: var(--space-2);
        width: 1.5rem;
        height: 1.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: none;
        background: transparent;
        color: var(--tx-3);
        cursor: pointer;
        border-radius: var(--radius-sm);
        transition: color var(--transition-fast), background-color var(--transition-fast);
      "
      aria-label="Clear search"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 3L11 11M3 11L11 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
  {/if}
</div>

<style>
  input:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--focus-ring-color);
  }

  input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  input::-webkit-search-cancel-button {
    display: none;
  }

  .search-clear:hover {
    color: var(--tx);
    background-color: var(--bg-3);
  }

  .search-clear:focus-visible {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
  }
</style>
