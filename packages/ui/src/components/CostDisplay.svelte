<script lang="ts">
  interface TokenCounts {
    input?: number;
    output?: number;
  }

  interface PricingTier {
    inputPerMillion: number;
    outputPerMillion: number;
  }

  interface Props {
    tokens: TokenCounts | number;
    pricing?: PricingTier;
    currency?: string;
    showBreakdown?: boolean;
    variant?: 'inline' | 'detailed';
    size?: 'sm' | 'md';
    class?: string;
  }

  let {
    tokens,
    pricing = { inputPerMillion: 3, outputPerMillion: 15 }, // Default to Sonnet pricing
    currency = '$',
    showBreakdown = false,
    variant = 'inline',
    size = 'md',
    class: className = '',
  }: Props = $props();

  // Normalize tokens
  const tokenCounts = $derived<TokenCounts>(
    typeof tokens === 'number' ? { input: 0, output: tokens } : tokens
  );

  const inputTokens = $derived(tokenCounts.input ?? 0);
  const outputTokens = $derived(tokenCounts.output ?? 0);

  // Calculate costs
  const inputCost = $derived((inputTokens / 1_000_000) * pricing.inputPerMillion);
  const outputCost = $derived((outputTokens / 1_000_000) * pricing.outputPerMillion);
  const totalCost = $derived(inputCost + outputCost);

  // Format cost
  function formatCost(cost: number): string {
    if (cost === 0) return `${currency}0.00`;
    if (cost < 0.01) return `<${currency}0.01`;
    if (cost < 1) return `${currency}${cost.toFixed(4)}`;
    return `${currency}${cost.toFixed(2)}`;
  }

  const fontSize = $derived(size === 'sm' ? '0.75rem' : 'var(--text-body-font-size)');
</script>

{#if variant === 'inline'}
  <span
    class="ui-cost-display {className}"
    style="
      font-family: var(--font-mono);
      font-size: {fontSize};
      font-variant-numeric: tabular-nums;
      color: var(--tx-2);
    "
    title="Input: {formatCost(inputCost)} | Output: {formatCost(outputCost)}"
  >
    {formatCost(totalCost)}
    {#if showBreakdown && (inputTokens > 0 || outputTokens > 0)}
      <span style="color: var(--tx-3); font-size: 0.9em;">
        ({inputTokens.toLocaleString()}→{outputTokens.toLocaleString()})
      </span>
    {/if}
  </span>
{:else}
  <!-- Detailed variant -->
  <div
    class="ui-cost-display {className}"
    style="
      font-family: var(--font-mono);
      font-size: {fontSize};
      font-variant-numeric: tabular-nums;
    "
  >
    {#if showBreakdown}
      <div style="display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.5rem;">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--tx-3);">Input ({inputTokens.toLocaleString()} tokens)</span>
          <span style="color: var(--tx-2);">{formatCost(inputCost)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--tx-3);">Output ({outputTokens.toLocaleString()} tokens)</span>
          <span style="color: var(--tx-2);">{formatCost(outputCost)}</span>
        </div>
        <div style="
          display: flex;
          justify-content: space-between;
          padding-top: 0.25rem;
          border-top: 1px solid var(--ui);
        ">
          <span style="color: var(--tx);">Total</span>
          <span style="color: var(--tx); font-weight: 500;">{formatCost(totalCost)}</span>
        </div>
      </div>
    {:else}
      <div style="display: flex; justify-content: space-between;">
        <span style="color: var(--tx-3);">Cost</span>
        <span style="color: var(--tx);">{formatCost(totalCost)}</span>
      </div>
    {/if}

    <div style="
      margin-top: 0.5rem;
      font-size: 0.7rem;
      color: var(--tx-3);
    ">
      Pricing: {currency}{pricing.inputPerMillion}/M in, {currency}{pricing.outputPerMillion}/M out
    </div>
  </div>
{/if}
