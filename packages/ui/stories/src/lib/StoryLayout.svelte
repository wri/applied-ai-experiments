<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { StoryMeta } from './story-registry';
  import { ThemeSwitcher } from '@wri-datalab/ui';

  interface Props {
    meta: StoryMeta;
    children: Snippet;
  }

  let { meta, children }: Props = $props();
</script>

<div class="story-layout">
  <header class="story-header">
    <div class="story-info">
      <h1 class="story-title">{meta.title}</h1>
      {#if meta.description}
        <p class="story-description">{meta.description}</p>
      {/if}
      {#if meta.category}
        <span class="story-category">{meta.category}</span>
      {/if}
    </div>
    <div class="story-controls">
      <ThemeSwitcher />
    </div>
  </header>

  <main class="story-content">
    {@render children()}
  </main>
</div>

<style>
  .story-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .story-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.5rem;
    border-bottom: 1px solid var(--ui);
    background-color: var(--bg-2);
  }

  .story-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .story-title {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--tx);
  }

  .story-description {
    margin: 0;
    font-size: var(--text-body-font-size);
    color: var(--tx-2);
    max-width: 60ch;
  }

  .story-category {
    display: inline-block;
    margin-top: 0.5rem;
    padding: 0.125rem 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tx-3);
    background-color: var(--bg-3);
    border-radius: 0.125rem;
  }

  .story-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .story-content {
    flex: 1;
    padding: 2rem;
    overflow: auto;
  }

  /* Global styles for story sections */
  .story-content :global(section) {
    margin-bottom: 2rem;
  }

  .story-content :global(section:last-child) {
    margin-bottom: 0;
  }

  .story-content :global(h3) {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tx-2);
    margin: 0 0 1rem 0;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--ui);
  }

  .story-content :global(.story-row) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .story-content :global(.story-row:last-child) {
    margin-bottom: 0;
  }

  .story-content :global(.story-grid) {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }
</style>
