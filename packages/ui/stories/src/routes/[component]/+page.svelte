<script lang="ts">
  import { page } from '$app/stores';
  import { getStoryById } from '$lib/story-registry';
  import StoryLayout from '$lib/StoryLayout.svelte';

  const componentId = $derived($page.params.component);
  const story = $derived(getStoryById(componentId));
</script>

{#if story}
  <StoryLayout meta={story.meta}>
    <story.component />
  </StoryLayout>
{:else}
  <div class="not-found">
    <h1>Story not found</h1>
    <p>No story found for component: <code>{componentId}</code></p>
    <a href="/">← Back to home</a>
  </div>
{/if}

<style>
  .not-found {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
    text-align: center;
  }

  .not-found h1 {
    margin: 0 0 0.5rem 0;
    font-family: var(--font-mono);
    font-size: 1.5rem;
    color: var(--tx);
  }

  .not-found p {
    margin: 0 0 1.5rem 0;
    color: var(--tx-2);
  }

  .not-found code {
    font-family: var(--font-mono);
    padding: 0.125rem 0.375rem;
    background-color: var(--bg-3);
    border-radius: 0.125rem;
  }

  .not-found a {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--primary);
    text-decoration: none;
  }

  .not-found a:hover {
    text-decoration: underline;
  }
</style>
