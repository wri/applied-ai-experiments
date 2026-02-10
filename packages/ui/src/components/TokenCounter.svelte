<script lang="ts">
  import { formatTokens } from '../utils/formatters';

  interface TokenBreakdown {
    input?: number;
    output?: number;
    total?: number;
  }

  interface Props {
    tokens: TokenBreakdown | number;
    limit?: number;
    showBreakdown?: boolean;
    variant?: 'inline' | 'detailed';
    size?: 'sm' | 'md';
    class?: string;
  }

  let {
    tokens,
    limit,
    showBreakdown = false,
    variant = 'inline',
    size = 'md',
    class: className = '',
  }: Props = $props();

  // Normalize tokens to breakdown format
  const breakdown = $derived<TokenBreakdown>(
    typeof tokens === 'number' ? { total: tokens } : tokens
  );

  const total = $derived(
    breakdown.total ?? (breakdown.input ?? 0) + (breakdown.output ?? 0)
  );

  // Calculate usage percentage and status
  const usagePercent = $derived(limit ? (total / limit) * 100 : 0);
  const status = $derived<'normal' | 'warning' | 'error'>(
    !limit
      ? 'normal'
      : usagePercent >= 100
        ? 'error'
        : usagePercent >= 80
          ? 'warning'
          : 'normal'
  );

  const statusColors = {
    normal: 'var(--tx)',
    warning: 'var(--warning-text)',
    error: 'var(--error-text)',
  };

  const fontSize = $derived(size === 'sm' ? '0.75rem' : 'var(--text-body-font-size)');
</script>

{#if variant === 'inline'}
  <span
    class="ui-token-counter {className}"
    style="
      font-family: var(--font-mono);
      font-size: {fontSize};
      font-variant-numeric: tabular-nums;
      color: {statusColors[status]};
    "
  >
    {formatTokens(total)}
    {#if limit}
      <span style="color: var(--tx-3);">/ {formatTokens(limit)}</span>
    {/if}
    {#if showBreakdown && (breakdown.input !== undefined || breakdown.output !== undefined)}
      <span style="color: var(--tx-3); font-size: 0.9em;">
        ({breakdown.input ?? 0} in / {breakdown.output ?? 0} out)
      </span>
    {/if}
  </span>
{:else}
  <!-- Detailed variant -->
  <div
    class="ui-token-counter {className}"
    style="
      font-family: var(--font-mono);
      font-size: {fontSize};
      font-variant-numeric: tabular-nums;
    "
  >
    {#if showBreakdown && (breakdown.input !== undefined || breakdown.output !== undefined)}
      <div style="display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.5rem;">
        {#if breakdown.input !== undefined}
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--tx-3);">Input</span>
            <span style="color: var(--tx);">{formatTokens(breakdown.input)}</span>
          </div>
        {/if}
        {#if breakdown.output !== undefined}
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--tx-3);">Output</span>
            <span style="color: var(--tx);">{formatTokens(breakdown.output)}</span>
          </div>
        {/if}
        <div style="
          display: flex;
          justify-content: space-between;
          padding-top: 0.25rem;
          border-top: 1px solid var(--ui);
        ">
          <span style="color: var(--tx-2);">Total</span>
          <span style="color: {statusColors[status]}; font-weight: 500;">{formatTokens(total)}</span>
        </div>
      </div>
    {:else}
      <div style="
        display: flex;
        justify-content: space-between;
        margin-bottom: {limit ? '0.5rem' : '0'};
      ">
        <span style="color: var(--tx-3);">Tokens</span>
        <span style="color: {statusColors[status]};">{formatTokens(total)}</span>
      </div>
    {/if}

    {#if limit}
      <div style="margin-top: 0.5rem;">
        <div style="
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.25rem;
          font-size: 0.75rem;
        ">
          <span style="color: var(--tx-3);">Usage</span>
          <span style="color: {statusColors[status]};">{Math.round(usagePercent)}%</span>
        </div>
        <div style="
          height: 4px;
          background: var(--bg-3);
          border-radius: var(--radius-full);
          overflow: hidden;
        ">
          <div style="
            height: 100%;
            width: {Math.min(usagePercent, 100)}%;
            background: {status === 'error' ? 'var(--error)' : status === 'warning' ? 'var(--warning)' : 'var(--primary)'};
            border-radius: var(--radius-full);
            transition: width var(--transition-normal) ease;
          "></div>
        </div>
        <div style="
          display: flex;
          justify-content: flex-end;
          margin-top: 0.25rem;
          font-size: 0.75rem;
          color: var(--tx-3);
        ">
          {formatTokens(limit)} limit
        </div>
      </div>
    {/if}
  </div>
{/if}
