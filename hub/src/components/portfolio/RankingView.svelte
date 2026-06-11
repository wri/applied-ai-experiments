<script lang="ts">
  import type { PortfolioStateAPI } from '../../lib/portfolio/state.svelte';
  import { getUnlockScores, getDirectDownstream } from '../../lib/portfolio/graph';
  import StatusDot from './StatusDot.svelte';

  interface Props {
    portfolio: PortfolioStateAPI;
  }

  const { portfolio }: Props = $props();

  const unlockScores = $derived(getUnlockScores(portfolio.experiments));

  const ranked = $derived(
    [...portfolio.filteredExperiments]
      .sort((a, b) => (unlockScores[b.slug] ?? 0) - (unlockScores[a.slug] ?? 0))
  );

  function downstreamSlugs(slug: string) {
    return getDirectDownstream(portfolio.experiments, slug).map((e) => e.title);
  }
</script>

<div class="ranking">
  <div class="ranking-header">
    <div class="col-rank">#</div>
    <div class="col-title">Experiment</div>
    <div class="col-theme">Theme</div>
    <div class="col-unlocks">Unlocks</div>
    <div class="col-status">Status</div>
  </div>
  {#each ranked as exp, i (exp.slug)}
    {@const primaryTheme = exp.themes[0]}
    {@const themeConfig = primaryTheme ? portfolio.taxonomy.themes[primaryTheme] : null}
    {@const score = unlockScores[exp.slug] ?? 0}
    <button
      type="button"
      class="row"
      class:selected={portfolio.selectedSlug === exp.slug}
      style={themeConfig ? `--theme-color: ${themeConfig.color}` : ''}
      onclick={() => portfolio.selectedSlug = exp.slug}
    >
      <div class="col-rank">{i + 1}</div>
      <div class="col-title">
        <span class="row-title">{exp.title}</span>
        {#if exp.surface}
          <span class="row-surface">{exp.surface}</span>
        {/if}
      </div>
      <div class="col-theme">
        {#if themeConfig}
          <span class="theme-chip" style="color: {themeConfig.color}">
            {themeConfig.short}
          </span>
        {:else}
          <span class="theme-chip theme-none">—</span>
        {/if}
      </div>
      <div class="col-unlocks">
        {#if score > 0}
          <span class="score">{score}</span>
          <span class="score-downstream" title={downstreamSlugs(exp.slug).join(', ')}>
            downstream
          </span>
        {:else}
          <span class="score-zero">—</span>
        {/if}
      </div>
      <div class="col-status">
        <StatusDot
          status={portfolio.effectiveStatus(exp.slug)}
          interactive
          onclick={() => portfolio.cycleStatus(exp.slug)}
        />
      </div>
    </button>
  {/each}
</div>

<style>
  .ranking {
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .ranking-header,
  .row {
    display: grid;
    grid-template-columns: 2.5rem 1fr 8rem 8rem 3rem;
    gap: 0.75rem;
    align-items: center;
    padding: 0.5rem 0.875rem;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    text-align: left;
    width: 100%;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--ui);
    color: var(--tx);
    cursor: pointer;
  }
  .ranking-header {
    background: var(--bg-3);
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tx-3);
    cursor: default;
    font-weight: 500;
  }
  .row:hover {
    background: var(--bg-3);
  }
  .row.selected {
    background: var(--bg-3);
    outline: 1px solid var(--primary);
    outline-offset: -1px;
  }
  .row:last-child {
    border-bottom: none;
  }
  .col-rank {
    color: var(--tx-3);
    font-size: 0.75rem;
  }
  .col-title {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }
  .row-title {
    color: var(--tx);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .row-surface {
    font-family: var(--font-body);
    font-size: 0.7rem;
    color: var(--tx-3);
  }
  .theme-chip {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 500;
  }
  .theme-none {
    color: var(--tx-3);
  }
  .col-unlocks {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }
  .score {
    color: var(--primary);
    font-weight: 500;
  }
  .score-downstream {
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tx-3);
  }
  .score-zero {
    color: var(--tx-3);
  }
  .col-status {
    display: flex;
    justify-content: center;
  }

  @media (max-width: 700px) {
    .ranking-header,
    .row {
      grid-template-columns: 2rem 1fr 3rem;
    }
    .col-theme,
    .col-unlocks {
      display: none;
    }
  }
</style>
