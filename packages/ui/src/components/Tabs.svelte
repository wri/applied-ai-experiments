<script lang="ts">
  interface TabItem {
    id: string;
    label: string;
    disabled?: boolean;
  }

  interface Props {
    items: TabItem[];
    active?: string;
    size?: 'sm' | 'md';
    class?: string;
    onchange?: (id: string) => void;
  }

  let {
    items,
    active = $bindable(items[0]?.id ?? ''),
    size = 'md',
    class: className = '',
    onchange,
  }: Props = $props();

  function handleTabClick(id: string, disabled?: boolean) {
    if (disabled) return;
    active = id;
    onchange?.(id);
  }

  function handleKeydown(event: KeyboardEvent, index: number) {
    const enabledItems = items.filter(item => !item.disabled);
    const currentIndex = enabledItems.findIndex(item => item.id === items[index].id);

    let newIndex = -1;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      newIndex = (currentIndex + 1) % enabledItems.length;
      event.preventDefault();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      newIndex = (currentIndex - 1 + enabledItems.length) % enabledItems.length;
      event.preventDefault();
    } else if (event.key === 'Home') {
      newIndex = 0;
      event.preventDefault();
    } else if (event.key === 'End') {
      newIndex = enabledItems.length - 1;
      event.preventDefault();
    }

    if (newIndex >= 0) {
      const newItem = enabledItems[newIndex];
      handleTabClick(newItem.id, newItem.disabled);
      const tabElement = document.querySelector(`[data-tab-id="${newItem.id}"]`) as HTMLElement;
      tabElement?.focus();
    }
  }

  const sizeStyles = {
    sm: {
      padding: 'var(--space-2) var(--space-3)',
      fontSize: 'var(--text-badge)',
    },
    md: {
      padding: 'var(--space-2) var(--space-4)',
      fontSize: 'var(--text-ui)',
    },
  };
</script>

<div
  class="ui-tabs {className}"
  role="tablist"
  style="
    display: flex;
    gap: var(--space-1);
    border-bottom: 1px solid var(--ui);
  "
>
  {#each items as item, index}
    {@const isActive = active === item.id}
    <button
      type="button"
      role="tab"
      data-tab-id={item.id}
      aria-selected={isActive}
      aria-disabled={item.disabled}
      tabindex={isActive ? 0 : -1}
      onclick={() => handleTabClick(item.id, item.disabled)}
      onkeydown={(e) => handleKeydown(e, index)}
      disabled={item.disabled}
      style="
        padding: {sizeStyles[size].padding};
        font-family: var(--font-mono);
        font-size: {sizeStyles[size].fontSize};
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        background: transparent;
        border: none;
        cursor: {item.disabled ? 'not-allowed' : 'pointer'};
        position: relative;
        transition: color var(--transition-fast);
        {isActive ? `
          color: var(--tx);
        ` : item.disabled ? `
          color: var(--tx-3);
          opacity: 0.5;
        ` : `
          color: var(--tx-2);
        `}
      "
    >
      {item.label}

      {#if isActive}
        <div
          class="tab-indicator"
          style="
            position: absolute;
            bottom: -1px;
            left: 0;
            right: 0;
            height: 2px;
            background-color: var(--primary);
          "
        ></div>
      {/if}
    </button>
  {/each}
</div>

<style>
  button:not(:disabled):hover {
    color: var(--tx);
  }

  button:focus-visible {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: -2px;
  }
</style>
