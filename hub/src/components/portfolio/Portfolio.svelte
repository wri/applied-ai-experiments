<script lang="ts">
  import type { PortfolioExperiment, Taxonomy } from '../../lib/portfolio/types';
  import { createPortfolioState } from '../../lib/portfolio/state.svelte';
  import LadderView from './LadderView.svelte';
  import RankingView from './RankingView.svelte';
  import DetailPanel from './DetailPanel.svelte';

  interface Props {
    experiments: PortfolioExperiment[];
    taxonomy: Taxonomy;
    baseUrl: string;
  }

  const { experiments, taxonomy, baseUrl }: Props = $props();

  const portfolio = createPortfolioState(experiments, taxonomy);
</script>

<div class="portfolio">
  <header class="portfolio-header">
    <div class="tabs" role="tablist">
      <button
        type="button"
        class="tab"
        class:active={portfolio.view === 'ladder'}
        role="tab"
        aria-selected={portfolio.view === 'ladder'}
        onclick={() => portfolio.view = 'ladder'}
      >
        Ladder
      </button>
      <button
        type="button"
        class="tab"
        class:active={portfolio.view === 'ranking'}
        role="tab"
        aria-selected={portfolio.view === 'ranking'}
        onclick={() => portfolio.view = 'ranking'}
      >
        Top Unlocks
      </button>
    </div>
    <div class="header-actions">
      {#if portfolio.themeFilter}
        <button
          type="button"
          class="filter-pill"
          onclick={() => portfolio.themeFilter = null}
          aria-label="Clear theme filter"
        >
          {taxonomy.themes[portfolio.themeFilter]?.short ?? portfolio.themeFilter}
          <span class="pill-x">×</span>
        </button>
      {/if}
      {#if portfolio.tracedSlug}
        <button
          type="button"
          class="filter-pill"
          onclick={() => portfolio.tracedSlug = null}
          aria-label="Clear trace"
        >
          Tracing: {portfolio.experiments.find((e) => e.slug === portfolio.tracedSlug)?.title ?? ''}
          <span class="pill-x">×</span>
        </button>
      {/if}
      <button
        type="button"
        class="reset-btn"
        onclick={() => portfolio.clearOverrides()}
        title="Reset local status overrides"
      >
        Reset
      </button>
    </div>
  </header>

  <div class="portfolio-body" class:split={portfolio.selectedSlug !== null}>
    <div class="portfolio-main">
      {#if portfolio.view === 'ladder'}
        <LadderView {portfolio} />
      {:else}
        <RankingView {portfolio} />
      {/if}
    </div>
    <DetailPanel {portfolio} {baseUrl} />
  </div>
</div>

<style>
  .portfolio {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .portfolio-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .tabs {
    display: flex;
    gap: 0.125rem;
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: var(--radius-sm);
    padding: 0.125rem;
  }
  .tab {
    background: transparent;
    border: none;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.375rem 0.75rem;
    border-radius: var(--radius-sm);
    color: var(--tx-2);
    cursor: pointer;
  }
  .tab:hover {
    color: var(--tx);
  }
  .tab.active {
    background: var(--bg);
    color: var(--primary);
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .filter-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    background: var(--bg-3);
    border: 1px solid var(--primary);
    color: var(--tx);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
  .pill-x {
    color: var(--tx-3);
    font-size: 0.85rem;
  }
  .reset-btn {
    background: var(--bg-2);
    border: 1px solid var(--ui);
    color: var(--tx-2);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.3rem 0.6rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
  .reset-btn:hover {
    border-color: var(--ui-2);
    color: var(--tx);
  }
  .portfolio-body {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  .portfolio-body.split {
    grid-template-columns: minmax(0, 1fr) 360px;
  }
  .portfolio-main {
    min-width: 0;
  }

  @media (max-width: 1000px) {
    .portfolio-body.split {
      grid-template-columns: 1fr;
    }
  }
</style>
