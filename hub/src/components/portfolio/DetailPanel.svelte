<script lang="ts">
  import type { PortfolioStateAPI } from '../../lib/portfolio/state.svelte';
  import { getDirectUpstream, getDirectDownstream, getAllUpstream } from '../../lib/portfolio/graph';
  import StatusDot from './StatusDot.svelte';

  interface Props {
    portfolio: PortfolioStateAPI;
    baseUrl: string;
  }

  const { portfolio, baseUrl }: Props = $props();

  const selected = $derived(
    portfolio.selectedSlug
      ? portfolio.experiments.find((e) => e.slug === portfolio.selectedSlug) ?? null
      : null
  );

  const upstream = $derived(
    selected ? getDirectUpstream(portfolio.experiments, selected.slug) : []
  );
  const downstream = $derived(
    selected ? getDirectDownstream(portfolio.experiments, selected.slug) : []
  );
  const upstreamCompleted = $derived(
    upstream.filter((e) => portfolio.effectiveStatus(e.slug) === 'completed').length
  );

  function traceAll() {
    if (selected) portfolio.tracedSlug = selected.slug;
  }
  function close() {
    portfolio.selectedSlug = null;
    portfolio.tracedSlug = null;
  }
</script>

{#if selected}
  {@const primaryTheme = selected.themes[0]}
  {@const themeConfig = primaryTheme ? portfolio.taxonomy.themes[primaryTheme] : null}
  <aside class="panel" aria-label="Experiment details">
    <div class="panel-header" style={themeConfig ? `--theme-color: ${themeConfig.color}` : ''}>
      <div class="panel-header-top">
        {#if themeConfig}
          <span class="theme-chip" style="color: {themeConfig.color}">
            {themeConfig.short}
          </span>
        {/if}
        <button type="button" class="close-btn" onclick={close} aria-label="Close detail panel">
          ×
        </button>
      </div>
      <h3 class="panel-title">{selected.title}</h3>
      {#if selected.surface}
        <div class="panel-surface">{selected.surface}</div>
      {/if}
    </div>

    <div class="panel-body">
      <p class="description">{selected.description}</p>

      <div class="meta-grid">
        <div class="meta">
          <span class="meta-label">Status</span>
          <div class="meta-value">
            <StatusDot
              status={portfolio.effectiveStatus(selected.slug)}
              interactive
              onclick={() => portfolio.cycleStatus(selected!.slug)}
            />
            <span>{portfolio.effectiveStatus(selected.slug)}</span>
          </div>
        </div>
        {#if selected.maturity}
          <div class="meta">
            <span class="meta-label">Maturity</span>
            <div class="meta-value">
              {portfolio.taxonomy.maturity[selected.maturity]?.name ?? selected.maturity}
            </div>
          </div>
        {/if}
        {#if selected.investment_type}
          <div class="meta">
            <span class="meta-label">Investment</span>
            <div class="meta-value">
              {portfolio.taxonomy.investment_types[selected.investment_type]?.label ?? selected.investment_type}
            </div>
          </div>
        {/if}
        {#if selected.origin}
          <div class="meta">
            <span class="meta-label">Origin</span>
            <div class="meta-value">{selected.origin}</div>
          </div>
        {/if}
      </div>

      {#if upstream.length > 0 || downstream.length > 0}
        <div class="deps-section">
          <div class="deps-header">
            <span class="deps-title">Dependencies</span>
            <button type="button" class="trace-btn" onclick={traceAll}>
              Trace all prerequisites
            </button>
          </div>
          {#if upstream.length > 0}
            <div class="deps-list">
              <span class="deps-list-label">
                Requires ({upstreamCompleted}/{upstream.length} done)
              </span>
              {#each upstream as dep (dep.slug)}
                <a
                  href="{baseUrl}experiments/{dep.slug}/"
                  class="dep-item"
                  onclick={(e: MouseEvent) => { e.preventDefault(); portfolio.selectedSlug = dep.slug; }}
                >
                  <StatusDot status={portfolio.effectiveStatus(dep.slug)} />
                  <span>{dep.title}</span>
                </a>
              {/each}
            </div>
          {/if}
          {#if downstream.length > 0}
            <div class="deps-list">
              <span class="deps-list-label">
                Unlocks ({downstream.length})
              </span>
              {#each downstream as dep (dep.slug)}
                <a
                  href="{baseUrl}experiments/{dep.slug}/"
                  class="dep-item"
                  onclick={(e: MouseEvent) => { e.preventDefault(); portfolio.selectedSlug = dep.slug; }}
                >
                  <StatusDot status={portfolio.effectiveStatus(dep.slug)} />
                  <span>{dep.title}</span>
                </a>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <div class="panel-footer">
        <a href="{baseUrl}experiments/{selected.slug}/" class="detail-link">
          Open full experiment page →
        </a>
      </div>
    </div>
  </aside>
{/if}

<style>
  .panel {
    position: sticky;
    top: calc(var(--header-height) + 1rem);
    align-self: start;
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    overflow: hidden;
    max-height: calc(100vh - var(--header-height) - 2rem);
    display: flex;
    flex-direction: column;
  }
  .panel-header {
    padding: 0.75rem 1rem;
    background: var(--bg-3);
    border-bottom: 1px solid var(--ui);
    border-left: 3px solid var(--theme-color, var(--primary));
  }
  .panel-header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.25rem;
  }
  .theme-chip {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 500;
  }
  .close-btn {
    background: transparent;
    border: none;
    color: var(--tx-3);
    cursor: pointer;
    font-size: 1.125rem;
    line-height: 1;
    padding: 0.125rem 0.375rem;
    border-radius: var(--radius-sm);
  }
  .close-btn:hover {
    color: var(--tx);
    background: var(--bg);
  }
  .panel-title {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tx);
    margin: 0;
  }
  .panel-surface {
    margin-top: 0.25rem;
    font-family: var(--font-body);
    font-size: 0.75rem;
    color: var(--tx-2);
  }
  .panel-body {
    padding: 1rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .description {
    font-family: var(--font-body);
    font-size: 0.875rem;
    line-height: 1.55;
    color: var(--tx);
    margin: 0;
  }
  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .meta-label {
    font-family: var(--font-mono);
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tx-3);
    font-weight: 500;
  }
  .meta-value {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--tx);
    text-transform: capitalize;
  }
  .deps-section {
    border-top: 1px solid var(--ui);
    padding-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }
  .deps-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .deps-title {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tx-2);
    font-weight: 500;
  }
  .trace-btn {
    background: transparent;
    border: 1px solid var(--ui);
    color: var(--tx-2);
    font-family: var(--font-mono);
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
  .trace-btn:hover {
    border-color: var(--primary);
    color: var(--primary);
  }
  .deps-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .deps-list-label {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tx-3);
  }
  .dep-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.375rem;
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--tx);
    text-decoration: none;
    border: 1px solid transparent;
  }
  .dep-item:hover {
    background: var(--bg-3);
    border-color: var(--ui);
  }
  .panel-footer {
    border-top: 1px solid var(--ui);
    padding-top: 0.75rem;
  }
  .detail-link {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--primary);
    text-decoration: none;
  }
  .detail-link:hover {
    text-decoration: underline;
  }
</style>
