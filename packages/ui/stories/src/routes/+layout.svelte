<script lang="ts">
  import type { Snippet } from 'svelte';
  import '@wri-datalab/ui/styles';
  import { getStoriesByCategory, type CategoryGroup } from '$lib/story-registry';
  import { page } from '$app/stores';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  const categories: CategoryGroup[] = getStoriesByCategory();

  // Get current story ID from URL
  const currentStoryId = $derived($page.params.component ?? null);
</script>

<div class="app-layout" data-variant="prototype">
  <aside class="sidebar">
    <header class="sidebar-header">
      <a href="/" class="sidebar-title">
        <span class="sidebar-logo">◇</span>
        UI Stories
      </a>
    </header>

    <nav class="sidebar-nav">
      {#each categories as category}
        <div class="nav-category">
          <h3 class="nav-category-title">{category.name}</h3>
          <ul class="nav-list">
            {#each category.stories as story}
              <li>
                <a
                  href="/{story.id}"
                  class="nav-link"
                  class:active={currentStoryId === story.id}
                >
                  {story.meta.title}
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </nav>

    <footer class="sidebar-footer">
      <span class="story-count">{categories.reduce((acc, c) => acc + c.stories.length, 0)} components</span>
    </footer>
  </aside>

  <main class="main-content">
    {@render children()}
  </main>
</div>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
    width: 100%;
  }

  .app-layout {
    display: flex;
    height: 100vh;
    overflow: hidden;
  }

  .sidebar {
    width: 260px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background-color: var(--bg-2);
    border-right: 1px solid var(--ui);
    overflow: hidden;
  }

  .sidebar-header {
    padding: 1rem;
    border-bottom: 1px solid var(--ui);
  }

  .sidebar-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: var(--font-mono);
    font-size: 1rem;
    font-weight: 600;
    color: var(--tx);
    text-decoration: none;
  }

  .sidebar-title:hover {
    color: var(--primary);
  }

  .sidebar-logo {
    font-size: 1.25rem;
    color: var(--primary);
  }

  .sidebar-nav {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 0;
  }

  .nav-category {
    padding: 0 1rem;
    margin-bottom: 1.5rem;
  }

  .nav-category:last-child {
    margin-bottom: 0;
  }

  .nav-category-title {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--tx-3);
    margin: 0 0 0.5rem 0;
    padding: 0 0.5rem;
  }

  .nav-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .nav-link {
    display: block;
    padding: 0.375rem 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: var(--tx-2);
    text-decoration: none;
    border-radius: 0.125rem;
    transition: all 100ms ease;
  }

  .nav-link:hover {
    color: var(--tx);
    background-color: var(--bg-3);
  }

  .nav-link.active {
    color: var(--primary);
    background-color: var(--bg-3);
  }

  .sidebar-footer {
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--ui);
  }

  .story-count {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--tx-3);
  }

  .main-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background-color: var(--bg);
  }
</style>
