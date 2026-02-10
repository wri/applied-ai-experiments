<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    children?: Snippet;
    class?: string;
  }

  let {
    maxWidth = 'lg',
    children,
    class: className = '',
  }: Props = $props();

  const maxWidthStyles = {
    sm: 'max-width: 640px;',
    md: 'max-width: 768px;',
    lg: 'max-width: 1024px;',
    xl: 'max-width: var(--max-width, 1200px);',
    full: 'max-width: 100%;',
  };
</script>

<footer
  class="ui-demo-footer {className}"
  style="
    background-color: var(--bg-2);
    border-top: 1px solid var(--ui);
    margin-top: auto;
  "
>
  <div
    class="footer-content"
    style="
      {maxWidthStyles[maxWidth]}
      margin: 0 auto;
      padding: var(--space-4, 1rem) var(--space-4, 1rem);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-3, 0.75rem);
      font-family: var(--font-mono);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--tx-3);
    "
  >
    {#if children}
      {@render children()}
    {:else}
      <a
        href="https://www.wri.org/data/applied-ai-group"
        target="_blank"
        rel="noopener noreferrer"
        class="footer-link"
      >WRI Applied AI Group</a>
      <span class="footer-separator">|</span>
      <a
        href="https://github.com/wri/applied-ai-experiments"
        target="_blank"
        rel="noopener noreferrer"
        class="footer-link"
      >GitHub</a>
    {/if}
  </div>
</footer>

<style>
  .footer-link {
    color: var(--tx-3);
    text-decoration: none;
    transition: color var(--transition-fast, 100ms) ease;
  }

  .footer-link:hover {
    color: var(--primary);
    text-decoration: none;
  }

  .footer-separator {
    color: var(--ui);
  }
</style>
