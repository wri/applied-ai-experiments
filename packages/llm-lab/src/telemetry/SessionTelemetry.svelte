<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { Modal, Badge, Button, Toggle, TokenCounter, LatencyBadge } from '@wri-datalab/ui';
  import RequestInspector from '../inspect/RequestInspector.svelte';
  import { formatUsd } from '../cost/cost';
  import { downloadJson } from '../export/download';
  import type { RunResponse } from '../types';
  import { sessionTelemetry, type TelemetryEntry } from './session-telemetry.svelte';
  import { telemetryPanel } from './telemetry-ui.svelte';
  import {
    formatEnergy,
    formatCarbon,
    GRID_PRESETS,
    type FactorOverrides,
    type TierFactors,
  } from './energy-carbon';

  interface Props {
    /**
     * Demo slug, used to namespace sessionStorage (all demos share one origin
     * on GitHub Pages, so a path-agnostic key would collide).
     */
    slug: string;
    /** Estimate energy/carbon for every call. Default true. */
    estimateEnergy?: boolean;
    /** Initial emission-factor overrides (e.g. your region's grid intensity). */
    emissionFactors?: FactorOverrides;
    /**
     * 'fab' (default): floating pill trigger, bottom-right.
     * 'none': no built-in trigger — pair with SessionTelemetryTrigger in the
     * header (or open programmatically via telemetryPanel.show()).
     * The modal itself is driven by the shared telemetryPanel singleton, so
     * two instances on one page would share a single modal.
     */
    trigger?: 'fab' | 'none';
  }

  let { slug, estimateEnergy = true, emissionFactors, trigger = 'fab' }: Props = $props();
  let expandedId = $state<string | null>(null);
  let showAssumptions = $state(false);

  const agg = $derived(sessionTelemetry.aggregates);
  // Newest first; copy before sorting so the store's array isn't mutated.
  const ordered = $derived([...sessionTelemetry.entries].sort((a, b) => b.seq - a.seq));
  // The live emission assumptions; editing these recomputes every figure.
  const factors = $derived(sessionTelemetry.factors);

  // Toggle state mirrors the store; effects push changes back.
  let pausedToggle = $state(sessionTelemetry.paused);
  let persistToggle = $state(sessionTelemetry.persist);
  // The prop is the initial value; the toggle drives the store thereafter.
  // untrack keeps this a one-time capture (and satisfies the prop-read lint).
  let energyToggle = $state(untrack(() => estimateEnergy));
  $effect(() => {
    sessionTelemetry.setPaused(pausedToggle);
  });
  $effect(() => {
    sessionTelemetry.setPersist(persistToggle);
  });
  $effect(() => {
    sessionTelemetry.setEnergyEnabled(energyToggle);
  });

  onMount(() => {
    sessionTelemetry.configure(slug);
    if (emissionFactors) sessionTelemetry.setFactors(emissionFactors);
  });

  // --- Assumptions control panel -------------------------------------------
  // Energy factors are stored per-token (tiny numbers); the inputs show Wh per
  // 1k tokens so they stay legible (0.6 Wh/1k ⇄ 0.0006 Wh/token).
  const TIERS: Array<keyof TierFactors> = ['budget', 'mid', 'frontier'];

  function num(e: Event): number {
    const v = parseFloat((e.target as HTMLInputElement).value);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  }
  function setOutPerK(tier: keyof TierFactors, perK: number): void {
    sessionTelemetry.setFactors({ outputWhPerToken: { [tier]: perK / 1000 } });
  }
  function setInPerK(tier: keyof TierFactors, perK: number): void {
    sessionTelemetry.setFactors({ inputWhPerToken: { [tier]: perK / 1000 } });
  }
  const gridIsPreset = $derived(
    GRID_PRESETS.some((p) => p.gramsPerKwh === factors.gridIntensityGramsPerKwh)
  );

  function energyChip(entry: TelemetryEntry): string | null {
    const est = sessionTelemetry.estimateFor(entry);
    return est ? formatCarbon(est.gramsCO2e) : null;
  }

  function costLabel(usd: number | null, approx = false): string {
    if (usd === null) return '—';
    return `${approx ? '≥ ' : ''}${formatUsd(usd)}`;
  }

  function paramChips(entry: TelemetryEntry): Array<[string, string]> {
    const p = entry.request.params;
    const chips: Array<[string, string]> = [];
    if (p.temperature !== undefined) chips.push(['temp', String(p.temperature)]);
    if (p.maxTokens !== undefined) chips.push(['max', String(p.maxTokens)]);
    if (p.topP !== undefined) chips.push(['top_p', String(p.topP)]);
    if (p.topK !== undefined) chips.push(['top_k', String(p.topK)]);
    return chips;
  }

  function status(entry: TelemetryEntry): { variant: 'success' | 'warning' | 'error' | 'default'; text: string } {
    if (entry.error) return { variant: 'error', text: entry.aborted ? 'aborted' : 'error' };
    if (entry.aborted) return { variant: 'warning', text: 'aborted' };
    if (entry.finishReason === 'length') return { variant: 'warning', text: 'length' };
    if (entry.finishReason) return { variant: 'default', text: entry.finishReason };
    return { variant: 'default', text: 'done' };
  }

  function inspectorResponses(entry: TelemetryEntry): RunResponse[] {
    return [
      {
        content: '',
        usage: entry.usage,
        latencyMs: entry.latencyMs,
        costUsd: entry.costUsd ?? undefined,
        finishReason: entry.finishReason,
        error: entry.error,
      },
    ];
  }

  function toggleExpand(id: string): void {
    expandedId = expandedId === id ? null : id;
  }

  function handleExport(): void {
    downloadJson(sessionTelemetry.exportJson(), `telemetry-${slug}-${new Date().toISOString().slice(0, 19)}`);
  }
</script>

{#if trigger === 'fab' && agg.totalCalls > 0}
  <button
    class="tel-fab"
    onclick={() => telemetryPanel.show()}
    title="Session telemetry — {agg.totalCalls} call{agg.totalCalls === 1 ? '' : 's'}"
    aria-label="Open session telemetry dashboard"
  >
    <span class="tel-fab__pulse" aria-hidden="true"></span>
    <span class="tel-fab__count">{agg.totalCalls}</span>
    <span class="tel-fab__sep">·</span>
    <span class="tel-fab__cost">{costLabel(agg.totalCostUsd, agg.hasUnknownCost)}</span>
    {#if agg.errorCount > 0}
      <span class="tel-fab__err" title="{agg.errorCount} error(s)">{agg.errorCount}</span>
    {/if}
  </button>
{/if}

<Modal bind:open={telemetryPanel.open} title="Session telemetry" size="lg">
  <div class="tel">
    <!-- Summary -->
    <div class="tel-summary">
      <div class="tel-stat">
        <span class="tel-stat__label">Calls</span>
        <span class="tel-stat__value">{agg.totalCalls}</span>
        {#if agg.errorCount > 0}<Badge variant="error">{agg.errorCount} err</Badge>{/if}
        {#if agg.abortedCount > 0}<Badge variant="warning">{agg.abortedCount} aborted</Badge>{/if}
      </div>
      <div class="tel-stat">
        <span class="tel-stat__label">Tokens</span>
        <TokenCounter
          tokens={{ input: agg.usageByType.inputTokens, output: agg.usageByType.outputTokens }}
          showBreakdown
          size="sm"
        />
      </div>
      <div class="tel-stat">
        <span class="tel-stat__label">Cost <span class="tel-est">est.</span></span>
        <span class="tel-stat__value">{costLabel(agg.totalCostUsd, agg.hasUnknownCost)}</span>
      </div>
      <div class="tel-stat">
        <span class="tel-stat__label">Avg latency</span>
        <span class="tel-stat__value">{Math.round(agg.avgLatencyMs)}<span class="tel-unit">ms</span></span>
      </div>
    </div>

    <!-- Token-by-type breakdown -->
    <div class="tel-tokens">
      <span class="tel-token"><b>{agg.usageByType.inputTokens.toLocaleString()}</b> in</span>
      <span class="tel-token"><b>{agg.usageByType.outputTokens.toLocaleString()}</b> out</span>
      <span class="tel-token tel-token--muted"><b>{agg.usageByType.totalTokens.toLocaleString()}</b> total</span>
      {#if agg.usageByType.cacheReadTokens > 0}
        <span class="tel-token"><b>{agg.usageByType.cacheReadTokens.toLocaleString()}</b> cache read</span>
      {/if}
      {#if agg.usageByType.cacheWriteTokens > 0}
        <span class="tel-token"><b>{agg.usageByType.cacheWriteTokens.toLocaleString()}</b> cache write</span>
      {/if}
      {#if agg.usageByType.thinkingTokens > 0}
        <span class="tel-token"><b>{agg.usageByType.thinkingTokens.toLocaleString()}</b> thinking</span>
      {/if}
    </div>

    <!-- Energy / carbon — estimated live from token usage + editable assumptions -->
    <div class="tel-eco" class:tel-eco--active={agg.hasEnergyData}>
      <span class="tel-eco__label">Energy &amp; carbon <span class="tel-est">est.</span></span>
      {#if agg.hasEnergyData}
        <span class="tel-eco__value" title="Estimated electricity">⚡ {formatEnergy(agg.totalWattHours)}</span>
        <span class="tel-eco__sep">·</span>
        <span class="tel-eco__value" title="Estimated emissions (grams CO₂-equivalent)">🌿 {formatCarbon(agg.totalGramsCO2e)} CO₂e</span>
      {:else if energyToggle}
        <span class="tel-eco__hint">figures appear after the first call reports token usage</span>
      {:else}
        <span class="tel-eco__hint">estimation off</span>
      {/if}
      <span class="tel-eco__spacer"></span>
      <button
        class="tel-eco__toggle"
        class:tel-eco__toggle--on={showAssumptions}
        onclick={() => (showAssumptions = !showAssumptions)}
        aria-expanded={showAssumptions}
        title="Edit the estimation assumptions"
      >⚙ Assumptions</button>
    </div>

    {#if showAssumptions}
      <div class="tel-assume">
        <div class="tel-assume__head">
          <span class="tel-assume__title">Estimation assumptions — edits recompute everything live</span>
          <Toggle bind:checked={energyToggle} label="Estimate" size="sm" />
          <span class="tel-assume__spacer"></span>
          <Button variant="ghost" size="sm" onclick={() => sessionTelemetry.resetFactors()}>Reset</Button>
        </div>

        <!-- Grid intensity + presets -->
        <div class="tel-assume__row">
          <label class="tel-field tel-field--wide">
            <span class="tel-field__label">Grid <abbr title="grams CO₂-equivalent per kilowatt-hour">gCO₂e/kWh</abbr></span>
            <input
              class="tel-input"
              type="number"
              min="0"
              step="5"
              value={factors.gridIntensityGramsPerKwh}
              oninput={(e) => sessionTelemetry.setFactors({ gridIntensityGramsPerKwh: num(e) })}
            />
          </label>
          <div class="tel-presets">
            {#each GRID_PRESETS as p (p.label)}
              <button
                class="tel-preset"
                class:tel-preset--on={factors.gridIntensityGramsPerKwh === p.gramsPerKwh}
                onclick={() => sessionTelemetry.setFactors({ gridIntensityGramsPerKwh: p.gramsPerKwh })}
                title="{p.gramsPerKwh} gCO₂e/kWh"
              >{p.label}</button>
            {/each}
            {#if !gridIsPreset}<span class="tel-preset tel-preset--custom">custom</span>{/if}
          </div>
        </div>

        <!-- Overhead + cache multipliers -->
        <div class="tel-assume__row">
          <label class="tel-field">
            <span class="tel-field__label"><abbr title="Power Usage Effectiveness — data-center overhead">PUE</abbr> ×</span>
            <input class="tel-input" type="number" min="1" step="0.05"
              value={factors.pue}
              oninput={(e) => sessionTelemetry.setFactors({ pue: num(e) })} />
          </label>
          <label class="tel-field">
            <span class="tel-field__label">Cache read ×</span>
            <input class="tel-input" type="number" min="0" step="0.05"
              value={factors.cacheReadFactor}
              oninput={(e) => sessionTelemetry.setFactors({ cacheReadFactor: num(e) })} />
          </label>
          <label class="tel-field">
            <span class="tel-field__label">Cache write ×</span>
            <input class="tel-input" type="number" min="0" step="0.05"
              value={factors.cacheWriteFactor}
              oninput={(e) => sessionTelemetry.setFactors({ cacheWriteFactor: num(e) })} />
          </label>
        </div>

        <!-- Per-token energy by tier (shown as Wh per 1k tokens) -->
        <div class="tel-assume__grid">
          <span class="tel-assume__gridlabel">Wh / 1k tok</span>
          {#each TIERS as tier (tier)}<span class="tel-assume__col">{tier}</span>{/each}

          <span class="tel-assume__gridlabel" title="Input/prefill tokens">prefill in</span>
          {#each TIERS as tier (tier)}
            <input class="tel-input tel-input--sm" type="number" min="0" step="0.01"
              value={(factors.inputWhPerToken[tier] * 1000).toFixed(2)}
              oninput={(e) => setInPerK(tier, num(e))} />
          {/each}

          <span class="tel-assume__gridlabel" title="Output + thinking tokens">decode out</span>
          {#each TIERS as tier (tier)}
            <input class="tel-input tel-input--sm" type="number" min="0" step="0.01"
              value={(factors.outputWhPerToken[tier] * 1000).toFixed(2)}
              oninput={(e) => setOutPerK(tier, num(e))} />
          {/each}
        </div>

        <p class="tel-assume__note">
          Order-of-magnitude estimates, not measurements. Decode dominates; cache reads
          are cheap; emissions = energy × grid intensity. Grid is the biggest lever.
        </p>
      </div>
    {/if}

    <!-- Per-call list -->
    {#if ordered.length === 0}
      <p class="tel-empty">No calls recorded yet.</p>
    {:else}
      <ul class="tel-list">
        {#each ordered as entry (entry.id)}
          {@const st = status(entry)}
          <li class="tel-row" class:tel-row--open={expandedId === entry.id}>
            <button class="tel-row__head" onclick={() => toggleExpand(entry.id)}>
              <span class="tel-row__seq">#{entry.seq}</span>
              <Badge variant="info">{entry.request.providerId}</Badge>
              <span class="tel-row__model">{entry.request.model}</span>
              {#if entry.request.label}<span class="tel-row__tag">{entry.request.label}</span>{/if}
              <span class="tel-row__params">
                {#each paramChips(entry) as [k, v] (k)}<span class="tel-chip">{k} {v}</span>{/each}
              </span>
              <span class="tel-row__spacer"></span>
              {#if entry.usage}
                <span class="tel-row__tok">
                  {(entry.usage.inputTokens || 0).toLocaleString()}→{(entry.usage.outputTokens || 0).toLocaleString()}
                  {#if entry.usage.thinkingTokens}<span class="tel-row__sub">+{entry.usage.thinkingTokens.toLocaleString()}t</span>{/if}
                  {#if entry.usage.cacheReadTokens}<span class="tel-row__sub">+{entry.usage.cacheReadTokens.toLocaleString()}c</span>{/if}
                </span>
              {:else}
                <span class="tel-row__tok tel-row__sub">—</span>
              {/if}
              <LatencyBadge ms={entry.latencyMs} size="sm" />
              <span class="tel-row__cost">{costLabel(entry.costUsd)}</span>
              {#if energyChip(entry)}
                <span class="tel-row__eco" title="Estimated CO₂e for this call">{energyChip(entry)}</span>
              {/if}
              <Badge variant={st.variant}>{st.text}</Badge>
            </button>
            {#if expandedId === entry.id}
              <div class="tel-row__body">
                <RequestInspector request={entry.request} responses={inspectorResponses(entry)} variant="panel" />
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    <p class="tel-note">
      Cost is an estimate from registry pricing (input + output tokens only).
      {#if agg.hasUnknownCost}Some models have no pricing data, so totals are a lower bound (≥).{/if}
      {#if agg.hasEnergyData}Energy &amp; carbon are rough order-of-magnitude estimates from token usage (per-tier factors × grid intensity), not measurements.{/if}
    </p>
  </div>

  {#snippet footer()}
    <div class="tel-controls">
      <Toggle bind:checked={pausedToggle} label="Pause" size="sm" />
      <Toggle bind:checked={persistToggle} label="Persist" size="sm" />
      <span class="tel-controls__spacer"></span>
      <Button variant="ghost" size="sm" onclick={() => sessionTelemetry.clear()}>Clear</Button>
      <Button variant="secondary" size="sm" onclick={handleExport}>Export JSON</Button>
    </div>
  {/snippet}
</Modal>

<style>
  /* --- Floating trigger (FAB) --- */
  .tel-fab {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    z-index: var(--z-fixed, 1200);
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.7rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    color: var(--tx);
    background: var(--bg-2);
    border: 1px solid var(--ui-2);
    border-radius: var(--radius-full);
    box-shadow: var(--shadow-default, 0 4px 12px rgba(0, 0, 0, 0.3));
    cursor: pointer;
    transition: border-color var(--transition-fast, 0.1s) ease, transform var(--transition-fast, 0.1s) ease;
  }
  .tel-fab:hover {
    border-color: var(--primary);
    transform: translateY(-1px);
  }
  .tel-fab__pulse {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: var(--radius-full);
    background: var(--primary);
    box-shadow: 0 0 0 0 var(--primary);
    animation: tel-pulse 2s infinite;
  }
  .tel-fab__count {
    font-weight: 600;
  }
  .tel-fab__sep {
    color: var(--tx-3);
  }
  .tel-fab__cost {
    color: var(--tx-2);
  }
  .tel-fab__err {
    margin-left: 0.1rem;
    padding: 0 0.35rem;
    border-radius: var(--radius-full);
    background: var(--error);
    color: #fff;
    font-weight: 600;
  }
  @keyframes tel-pulse {
    0% {
      box-shadow: 0 0 0 0 color-mix(in oklch, var(--primary) 60%, transparent);
    }
    70% {
      box-shadow: 0 0 0 6px transparent;
    }
    100% {
      box-shadow: 0 0 0 0 transparent;
    }
  }

  /* --- Dashboard body --- */
  .tel {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    font-family: var(--font-mono);
    color: var(--tx);
  }

  .tel-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.5rem;
  }
  .tel-stat {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.6rem 0.7rem;
    background: var(--bg-3);
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
  }
  .tel-stat__label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--tx-3);
  }
  .tel-stat__value {
    font-size: 1.1rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .tel-unit,
  .tel-est {
    font-size: 0.7rem;
    font-weight: 400;
    color: var(--tx-3);
  }

  .tel-tokens {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.9rem;
    padding: 0.4rem 0.1rem;
    font-size: 0.75rem;
    color: var(--tx-2);
  }
  .tel-token b {
    color: var(--tx);
    font-variant-numeric: tabular-nums;
  }
  .tel-token--muted {
    color: var(--tx-3);
  }

  .tel-eco {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.7rem;
    border: 1px dashed var(--ui-2);
    border-radius: var(--radius-md);
    font-size: 0.72rem;
  }
  .tel-eco--active {
    border-style: solid;
    border-color: var(--success);
  }
  .tel-eco__label {
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--tx-2);
  }
  .tel-eco__hint {
    color: var(--tx-3);
    font-style: italic;
  }
  .tel-eco__value {
    color: var(--success-text);
    font-variant-numeric: tabular-nums;
  }
  .tel-eco__sep {
    color: var(--tx-3);
  }
  .tel-eco__spacer {
    flex: 1;
  }
  .tel-eco__toggle {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--tx-2);
    background: var(--bg-2);
    border: 1px solid var(--ui-2);
    border-radius: var(--radius-sm);
    padding: 0.15rem 0.45rem;
    cursor: pointer;
  }
  .tel-eco__toggle:hover {
    border-color: var(--primary);
    color: var(--tx);
  }
  .tel-eco__toggle--on {
    border-color: var(--primary);
    color: var(--tx);
    background: var(--bg-3);
  }

  /* --- Assumptions control panel (dense) --- */
  .tel-assume {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.6rem 0.7rem;
    background: var(--bg-3);
    border: 1px solid var(--ui-2);
    border-radius: var(--radius-md);
    font-size: 0.72rem;
  }
  .tel-assume__head {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .tel-assume__title {
    color: var(--tx-2);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 0.62rem;
  }
  .tel-assume__spacer {
    flex: 1;
  }
  .tel-assume__row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.5rem 0.9rem;
  }
  .tel-field {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .tel-field--wide {
    min-width: 9rem;
  }
  .tel-field__label {
    font-size: 0.62rem;
    color: var(--tx-3);
    white-space: nowrap;
  }
  .tel-field__label abbr {
    text-decoration: underline dotted;
    cursor: help;
  }
  .tel-input {
    width: 6rem;
    padding: 0.2rem 0.4rem;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    color: var(--tx);
    background: var(--bg);
    border: 1px solid var(--ui-2);
    border-radius: var(--radius-sm);
  }
  .tel-input:focus {
    outline: none;
    border-color: var(--primary);
  }
  .tel-input--sm {
    width: 100%;
  }

  .tel-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: center;
  }
  .tel-preset {
    font-family: var(--font-mono);
    font-size: 0.64rem;
    color: var(--tx-2);
    background: var(--bg);
    border: 1px solid var(--ui-2);
    border-radius: var(--radius-full);
    padding: 0.1rem 0.45rem;
    cursor: pointer;
  }
  .tel-preset:hover {
    border-color: var(--primary);
  }
  .tel-preset--on {
    border-color: var(--primary);
    color: var(--tx);
    background: var(--bg-3);
  }
  .tel-preset--custom {
    color: var(--tx-3);
    font-style: italic;
    cursor: default;
    border-style: dashed;
  }

  .tel-assume__grid {
    display: grid;
    grid-template-columns: 5.5rem repeat(3, 1fr);
    gap: 0.3rem 0.5rem;
    align-items: center;
    max-width: 26rem;
  }
  .tel-assume__gridlabel {
    font-size: 0.62rem;
    color: var(--tx-3);
    white-space: nowrap;
  }
  .tel-assume__col {
    font-size: 0.62rem;
    color: var(--tx-2);
    text-align: center;
    text-transform: capitalize;
  }
  .tel-assume__note {
    margin: 0;
    font-size: 0.64rem;
    color: var(--tx-3);
    line-height: 1.4;
  }

  .tel-row__eco {
    color: var(--success-text);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    font-size: 0.7rem;
  }

  .tel-empty {
    margin: 0;
    padding: 1rem;
    text-align: center;
    color: var(--tx-3);
    font-size: 0.8rem;
  }

  .tel-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .tel-row {
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    background: var(--bg-3);
    overflow: hidden;
  }
  .tel-row--open {
    border-color: var(--ui-3);
  }
  .tel-row__head {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.6rem;
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    font-family: inherit;
    font-size: 0.75rem;
    text-align: left;
  }
  .tel-row__head:hover {
    background: var(--bg-2);
  }
  .tel-row__seq {
    color: var(--tx-3);
    font-variant-numeric: tabular-nums;
  }
  .tel-row__model {
    color: var(--tx);
    white-space: nowrap;
  }
  .tel-row__tag {
    padding: 0.05rem 0.35rem;
    border-radius: var(--radius-sm);
    background: var(--warning-subtle, var(--bg));
    color: var(--warning-text);
    font-size: 0.68rem;
  }
  .tel-row__params {
    display: inline-flex;
    gap: 0.3rem;
    flex-wrap: wrap;
  }
  .tel-chip {
    padding: 0.02rem 0.3rem;
    border: 1px solid var(--ui-2);
    border-radius: var(--radius-sm);
    color: var(--tx-2);
    font-size: 0.66rem;
  }
  .tel-row__spacer {
    flex: 1;
  }
  .tel-row__tok {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .tel-row__sub {
    color: var(--tx-3);
  }
  .tel-row__cost {
    color: var(--tx-2);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .tel-row__body {
    padding: 0.6rem;
    border-top: 1px solid var(--ui);
    background: var(--bg-2);
  }

  .tel-note {
    margin: 0;
    font-size: 0.68rem;
    color: var(--tx-3);
    line-height: 1.4;
  }

  .tel-controls {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
  }
  .tel-controls__spacer {
    flex: 1;
  }
</style>
