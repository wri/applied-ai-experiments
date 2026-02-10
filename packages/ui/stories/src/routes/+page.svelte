<script lang="ts">
  import { getStoriesByCategory, type CategoryGroup } from '$lib/story-registry';
  import { ThemeSwitcher } from '@wri-datalab/ui';

  const categories: CategoryGroup[] = getStoriesByCategory();
  const totalComponents = categories.reduce((acc, c) => acc + c.stories.length, 0);
</script>

<div class="home">
  <header class="home-header">
    <div class="home-info">
      <h1 class="home-title">@wri-datalab/ui</h1>
      <p class="home-subtitle">Component library with Prototype design system</p>
    </div>
    <ThemeSwitcher />
  </header>

  <main class="home-content">
    <div class="stats">
      <div class="stat">
        <span class="stat-value">{totalComponents}</span>
        <span class="stat-label">Components</span>
      </div>
      <div class="stat">
        <span class="stat-value">{categories.length}</span>
        <span class="stat-label">Categories</span>
      </div>
    </div>

    <div class="component-grid">
      {#each categories as category}
        <section class="category-section">
          <h2 class="category-title">{category.name}</h2>
          <div class="component-cards">
            {#each category.stories as story}
              <a href="/{story.id}" class="component-card">
                <h3 class="component-name">{story.meta.title}</h3>
                {#if story.meta.description}
                  <p class="component-description">{story.meta.description}</p>
                {/if}
              </a>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  </main>
</div>

<style>
  .home {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .home-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2rem;
    border-bottom: 1px solid var(--ui);
    background-color: var(--bg-2);
  }

  .home-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .home-title {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 1.75rem;
    font-weight: 600;
    color: var(--tx);
  }

  .home-subtitle {
    margin: 0;
    font-size: var(--text-body-font-size);
    color: var(--tx-2);
  }

  .home-content {
    flex: 1;
    overflow: auto;
    padding: 2rem;
  }

  .stats {
    display: flex;
    gap: 2rem;
    margin-bottom: 2rem;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stat-value {
    font-family: var(--font-mono);
    font-size: 2rem;
    font-weight: 600;
    color: var(--primary);
  }

  .stat-label {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tx-3);
  }

  .component-grid {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .category-section {
    margin: 0;
  }

  .category-title {
    margin: 0 0 1rem 0;
    font-family: var(--font-mono);
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tx-2);
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--ui);
  }

  .component-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
  }

  .component-card {
    display: flex;
    flex-direction: column;
    padding: 1rem;
    background-color: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: 0.25rem;
    text-decoration: none;
    transition: all 100ms ease;
  }

  .component-card:hover {
    border-color: var(--primary);
    background-color: var(--bg-3);
  }

  .component-name {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--tx);
  }

  .component-description {
    margin: 0.5rem 0 0 0;
    font-size: 0.8125rem;
    color: var(--tx-3);
    line-height: 1.4;
  }
</style>
