<script lang="ts">
  import type { PortfolioStateAPI } from '../../lib/portfolio/state.svelte';
  import type { Maturity } from '../../lib/portfolio/types';
  import ExperimentCard from './ExperimentCard.svelte';
  import { getUnlockScores } from '../../lib/portfolio/graph';

  interface Props {
    portfolio: PortfolioStateAPI;
  }

  const { portfolio }: Props = $props();

  const maturityOrder: Maturity[] = ['L1', 'L2', 'L3'];

  const unlockScores = $derived(getUnlockScores(portfolio.experiments));

  function experimentsFor(themeKey: string, maturity: Maturity) {
    return portfolio.filteredExperiments.filter((e) =>
      e.themes[0] === themeKey && e.maturity === maturity
    );
  }

  function highlightFor(slug: string): 'upstream' | 'downstream' | 'self' | null {
    if (!portfolio.tracedSlug) return null;
    if (slug === portfolio.tracedSlug) return 'self';
    if (portfolio.tracedUpstream.has(slug)) return 'upstream';
    if (portfolio.tracedDownstream.has(slug)) return 'downstream';
    return null;
  }

  // Experiments that don't have a maturity set yet — "classify me" bucket
  const unclassified = $derived(
    portfolio.filteredExperiments.filter((e) => !e.maturity)
  );
</script>

<div class="ladder">
  {#each portfolio.taxonomy.pillars as pillar}
    <div class="pillar">
      <div class="pillar-header">{pillar.name}</div>
      <div class="pillar-body">
        <!-- Column headers -->
        <div class="ladder-grid ladder-grid-header">
          <div class="theme-label-slot"></div>
          {#each maturityOrder as m}
            <div class="col-header">
              <div class="col-title">{portfolio.taxonomy.maturity[m].name}</div>
              <div class="col-sub">{portfolio.taxonomy.maturity[m].sub}</div>
            </div>
          {/each}
        </div>
        {#each pillar.themes as themeKey}
          {@const theme = portfolio.taxonomy.themes[themeKey]}
          {#if theme}
            <div class="ladder-grid">
              <button
                type="button"
                class="theme-label"
                class:active={portfolio.themeFilter === themeKey}
                style="--theme-color: {theme.color}"
                onclick={() => {
                  portfolio.themeFilter = portfolio.themeFilter === themeKey ? null : themeKey;
                }}
                aria-label={`Filter by ${theme.name}`}
              >
                <span class="theme-label-name">{theme.short}</span>
              </button>
              {#each maturityOrder as m}
                {@const cellExps = experimentsFor(themeKey, m)}
                <div class="cell">
                  {#each cellExps as exp (exp.slug)}
                    <ExperimentCard
                      experiment={exp}
                      taxonomy={portfolio.taxonomy}
                      status={portfolio.effectiveStatus(exp.slug)}
                      selected={portfolio.selectedSlug === exp.slug}
                      highlight={highlightFor(exp.slug)}
                      unlockScore={unlockScores[exp.slug] ?? 0}
                      onSelect={() => portfolio.selectedSlug = exp.slug}
                      onStatusCycle={() => portfolio.cycleStatus(exp.slug)}
                    />
                  {/each}
                  {#if cellExps.length === 0}
                    <div class="cell-empty"></div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/each}

  {#if unclassified.length > 0}
    <div class="pillar pillar-unclassified">
      <div class="pillar-header">Classify me</div>
      <div class="unclassified-grid">
        {#each unclassified as exp (exp.slug)}
          <ExperimentCard
            experiment={exp}
            taxonomy={portfolio.taxonomy}
            status={portfolio.effectiveStatus(exp.slug)}
            selected={portfolio.selectedSlug === exp.slug}
            highlight={highlightFor(exp.slug)}
            unlockScore={unlockScores[exp.slug] ?? 0}
            onSelect={() => portfolio.selectedSlug = exp.slug}
            onStatusCycle={() => portfolio.cycleStatus(exp.slug)}
          />
        {/each}
      </div>
      <div class="unclassified-hint">
        These experiments don't have <code>maturity</code> or a primary theme set in <code>info.yaml</code> yet.
      </div>
    </div>
  {/if}
</div>

<style>
  .ladder {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .pillar {
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .pillar-header {
    padding: 0.625rem 1rem;
    background: var(--bg-3);
    border-bottom: 1px solid var(--ui);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tx-2);
  }
  .pillar-body {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .ladder-grid {
    display: grid;
    grid-template-columns: 160px 1fr 1fr 1fr;
    gap: 0.5rem;
    align-items: stretch;
  }
  .ladder-grid-header {
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--ui);
    margin-bottom: 0.25rem;
  }
  .col-header {
    padding: 0.375rem 0.5rem;
    font-family: var(--font-mono);
  }
  .col-title {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tx-2);
    font-weight: 500;
  }
  .col-sub {
    font-size: 0.65rem;
    color: var(--tx-3);
  }
  .theme-label-slot {
    min-width: 160px;
  }
  .theme-label {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 0.5rem 0.625rem;
    background: var(--bg);
    border: 1px solid var(--ui);
    border-left: 3px solid var(--theme-color);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--tx);
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: background 150ms ease;
  }
  .theme-label:hover {
    background: var(--bg-3);
  }
  .theme-label.active {
    background: var(--bg-3);
    outline: 1px solid var(--primary);
  }
  .theme-label-name {
    color: var(--theme-color);
  }
  .cell {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.25rem;
    min-height: 64px;
    background: var(--bg);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
  }
  .cell-empty {
    flex: 1;
    min-height: 48px;
  }
  .pillar-unclassified {
    border-style: dashed;
  }
  .unclassified-grid {
    padding: 0.75rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.5rem;
  }
  .unclassified-hint {
    padding: 0 1rem 0.75rem;
    font-family: var(--font-body);
    font-size: 0.75rem;
    color: var(--tx-3);
  }
  .unclassified-hint code {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    background: var(--bg);
    padding: 0.05rem 0.25rem;
    border-radius: var(--radius-sm);
    color: var(--tx-2);
  }

  @media (max-width: 900px) {
    .ladder-grid {
      grid-template-columns: 120px 1fr;
      grid-auto-rows: auto;
    }
    .col-header:nth-child(3),
    .col-header:nth-child(4) {
      display: none;
    }
    .cell {
      grid-column: 2;
    }
  }
</style>
