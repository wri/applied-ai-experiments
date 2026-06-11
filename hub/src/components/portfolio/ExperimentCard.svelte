<script lang="ts">
  import type { PortfolioExperiment, Taxonomy, Status } from '../../lib/portfolio/types';
  import StatusDot from './StatusDot.svelte';

  interface Props {
    experiment: PortfolioExperiment;
    taxonomy: Taxonomy;
    status: Status;
    selected?: boolean;
    highlight?: 'upstream' | 'downstream' | 'self' | null;
    unlockScore?: number;
    onSelect?: () => void;
    onStatusCycle?: () => void;
  }

  const {
    experiment,
    taxonomy,
    status,
    selected = false,
    highlight = null,
    unlockScore = 0,
    onSelect,
    onStatusCycle
  }: Props = $props();

  const primaryTheme = $derived(experiment.themes[0]);
  const themeColor = $derived(
    primaryTheme ? taxonomy.themes[primaryTheme]?.color ?? 'var(--tx-3)' : 'var(--tx-3)'
  );
  const themeShort = $derived(
    primaryTheme ? taxonomy.themes[primaryTheme]?.short ?? primaryTheme : '—'
  );
</script>

<button
  type="button"
  class="card"
  class:selected
  class:upstream={highlight === 'upstream'}
  class:downstream={highlight === 'downstream'}
  class:self={highlight === 'self'}
  style="--theme-color: {themeColor}"
  onclick={onSelect}
  aria-label={`${experiment.title} — ${status}`}
>
  <div class="card-header">
    <span class="theme-chip">{themeShort}</span>
    <StatusDot {status} interactive={!!onStatusCycle} onclick={onStatusCycle} />
  </div>
  <div class="card-title">{experiment.title}</div>
  {#if experiment.surface}
    <div class="card-surface">{experiment.surface}</div>
  {/if}
  {#if unlockScore > 0}
    <div class="card-unlock">unlocks {unlockScore}</div>
  {/if}
</button>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    width: 100%;
    text-align: left;
    padding: 0.625rem 0.75rem;
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-left: 3px solid var(--theme-color);
    border-radius: var(--radius-sm);
    color: var(--tx);
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease, transform 150ms ease;
  }
  .card:hover {
    background: var(--bg-3);
    border-color: var(--ui-2);
  }
  .card.selected,
  .card.self {
    background: var(--bg-3);
    border-color: var(--primary);
    outline: 1px solid var(--primary);
    outline-offset: -1px;
  }
  .card.upstream {
    border-color: var(--info, #38bdf8);
  }
  .card.downstream {
    border-color: var(--success, #4ade80);
  }
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .theme-chip {
    font-family: var(--font-mono);
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-color);
    font-weight: 500;
  }
  .card-title {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    line-height: 1.3;
    color: var(--tx);
    font-weight: 500;
  }
  .card-surface {
    font-family: var(--font-body);
    font-size: 0.75rem;
    color: var(--tx-2);
    line-height: 1.35;
  }
  .card-unlock {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--tx-3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
