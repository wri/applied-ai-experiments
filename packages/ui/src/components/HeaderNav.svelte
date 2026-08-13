<script module lang="ts">
  export interface HeaderNavItem {
    id: string;
    /** Author in sentence case; rendered uppercase by the nav styling. */
    label: string;
    /** Renders an <a>. Mutually exclusive with onclick. */
    href?: string;
    /** Renders a <button>. Mutually exclusive with href. */
    onclick?: () => void;
  }
</script>

<script lang="ts">
  interface Props {
    items: HeaderNavItem[];
    /** id of the active item */
    active?: string;
    ariaLabel?: string;
    class?: string;
  }

  let {
    items,
    active,
    ariaLabel = 'Demo sections',
    class: className = '',
  }: Props = $props();
</script>

<nav class="ui-header-nav {className}" aria-label={ariaLabel}>
  {#each items as item (item.id)}
    {#if item.href}
      <a
        class="ui-header-nav__item"
        class:active={item.id === active}
        href={item.href}
        aria-current={item.id === active ? 'page' : undefined}
      >{item.label}</a>
    {:else}
      <button
        type="button"
        class="ui-header-nav__item"
        class:active={item.id === active}
        aria-pressed={item.id === active}
        onclick={item.onclick}
      >{item.label}</button>
    {/if}
  {/each}
</nav>

<style>
  .ui-header-nav {
    display: flex;
    align-items: center;
    gap: var(--space-3, 0.75rem);
  }

  /* Self-contained type treatment so the component looks the same inside
     DemoHeader's nav slot and in custom headers. */
  .ui-header-nav__item {
    display: inline-flex;
    align-items: center;
    height: 2rem;
    padding: 0;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    font-family: var(--font-mono);
    font-size: var(--text-ui);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    color: var(--tx-2);
    text-decoration: none;
    cursor: pointer;
    transition: color var(--transition-fast, 100ms) ease;
  }

  .ui-header-nav__item:hover {
    color: var(--tx);
  }

  .ui-header-nav__item.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }

  .ui-header-nav__item:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
</style>
