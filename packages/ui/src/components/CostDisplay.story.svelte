<script lang="ts" module>
  export const meta = {
    title: 'CostDisplay',
    description: 'Display API costs based on token usage and pricing',
    category: 'AI Components',
  };
</script>

<script lang="ts">
  import CostDisplay from './CostDisplay.svelte';

  // Pricing tiers for different models
  const sonnetPricing = { inputPerMillion: 3, outputPerMillion: 15 };
  const opusPricing = { inputPerMillion: 15, outputPerMillion: 75 };
  const haikuPricing = { inputPerMillion: 0.25, outputPerMillion: 1.25 };
</script>

<section>
  <h3>Basic Usage</h3>
  <div style="display: flex; gap: 2rem; align-items: center;">
    <CostDisplay tokens={{ input: 1000, output: 500 }} />
    <CostDisplay tokens={{ input: 10000, output: 5000 }} />
    <CostDisplay tokens={{ input: 100000, output: 50000 }} />
  </div>
</section>

<section>
  <h3>With Breakdown</h3>
  <div style="display: flex; gap: 2rem; align-items: center;">
    <CostDisplay tokens={{ input: 2500, output: 1200 }} showBreakdown />
    <CostDisplay tokens={{ input: 50000, output: 25000 }} showBreakdown />
  </div>
</section>

<section>
  <h3>Different Models</h3>
  <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 400px;">
    <div style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background: var(--bg-2);
      border: 1px solid var(--ui);
      border-radius: var(--radius-md);
    ">
      <span style="font-family: var(--font-ui);">Claude 3 Haiku</span>
      <CostDisplay
        tokens={{ input: 10000, output: 5000 }}
        pricing={haikuPricing}
        showBreakdown
      />
    </div>
    <div style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background: var(--bg-2);
      border: 1px solid var(--ui);
      border-radius: var(--radius-md);
    ">
      <span style="font-family: var(--font-ui);">Claude 3.5 Sonnet</span>
      <CostDisplay
        tokens={{ input: 10000, output: 5000 }}
        pricing={sonnetPricing}
        showBreakdown
      />
    </div>
    <div style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background: var(--bg-2);
      border: 1px solid var(--ui);
      border-radius: var(--radius-md);
    ">
      <span style="font-family: var(--font-ui);">Claude Opus 4.5</span>
      <CostDisplay
        tokens={{ input: 10000, output: 5000 }}
        pricing={opusPricing}
        showBreakdown
      />
    </div>
  </div>
</section>

<section>
  <h3>Detailed Variant</h3>
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; max-width: 600px;">
    <div style="
      background: var(--bg-2);
      border: 1px solid var(--ui);
      border-radius: var(--radius-md);
      padding: 1rem;
    ">
      <CostDisplay
        tokens={{ input: 5000, output: 2000 }}
        pricing={haikuPricing}
        showBreakdown
        variant="detailed"
      />
    </div>
    <div style="
      background: var(--bg-2);
      border: 1px solid var(--ui);
      border-radius: var(--radius-md);
      padding: 1rem;
    ">
      <CostDisplay
        tokens={{ input: 5000, output: 2000 }}
        pricing={sonnetPricing}
        showBreakdown
        variant="detailed"
      />
    </div>
    <div style="
      background: var(--bg-2);
      border: 1px solid var(--ui);
      border-radius: var(--radius-md);
      padding: 1rem;
    ">
      <CostDisplay
        tokens={{ input: 5000, output: 2000 }}
        pricing={opusPricing}
        showBreakdown
        variant="detailed"
      />
    </div>
  </div>
</section>

<section>
  <h3>Sizes</h3>
  <div style="display: flex; gap: 2rem; align-items: center;">
    <div>
      <p style="margin: 0 0 0.25rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">Small</p>
      <CostDisplay tokens={{ input: 1000, output: 500 }} size="sm" showBreakdown />
    </div>
    <div>
      <p style="margin: 0 0 0.25rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">Medium</p>
      <CostDisplay tokens={{ input: 1000, output: 500 }} size="md" showBreakdown />
    </div>
  </div>
</section>

<section>
  <h3>Very Small Costs</h3>
  <p style="margin-bottom: 1rem; font-size: var(--font-size-sm); color: var(--tx-2);">
    Costs under $0.01 show as "&lt;$0.01"
  </p>
  <div style="display: flex; gap: 2rem; align-items: center;">
    <CostDisplay tokens={{ input: 100, output: 50 }} showBreakdown />
    <CostDisplay tokens={{ input: 10, output: 5 }} showBreakdown />
    <CostDisplay tokens={0} />
  </div>
</section>

<section>
  <h3>Usage in Context</h3>
  <div style="
    max-width: 500px;
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    padding: 1rem;
  ">
    <div style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--ui);
    ">
      <span style="font-family: var(--font-ui); font-weight: 500;">Session Summary</span>
      <span style="font-family: var(--font-ui); color: var(--tx-3); font-size: 0.875rem;">claude-3-5-sonnet</span>
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      <div style="display: flex; justify-content: space-between;">
        <span style="color: var(--tx-3);">Messages</span>
        <span>12</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: var(--tx-3);">Total Tokens</span>
        <span>45,230</span>
      </div>
      <div style="
        display: flex;
        justify-content: space-between;
        padding-top: 0.75rem;
        border-top: 1px solid var(--ui);
      ">
        <span style="font-weight: 500;">Estimated Cost</span>
        <CostDisplay
          tokens={{ input: 32000, output: 13230 }}
          pricing={sonnetPricing}
        />
      </div>
    </div>
  </div>
</section>

<section>
  <h3>Cost Comparison Table</h3>
  <div style="
    overflow-x: auto;
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
  ">
    <table style="
      width: 100%;
      border-collapse: collapse;
      font-family: var(--font-ui);
      font-size: 0.875rem;
    ">
      <thead>
        <tr style="background: var(--bg-3);">
          <th style="padding: 0.75rem; text-align: left; border-bottom: 1px solid var(--ui);">Usage</th>
          <th style="padding: 0.75rem; text-align: right; border-bottom: 1px solid var(--ui);">Haiku</th>
          <th style="padding: 0.75rem; text-align: right; border-bottom: 1px solid var(--ui);">Sonnet</th>
          <th style="padding: 0.75rem; text-align: right; border-bottom: 1px solid var(--ui);">Opus</th>
        </tr>
      </thead>
      <tbody>
        {#each [
          { label: 'Light (1K/500)', input: 1000, output: 500 },
          { label: 'Medium (10K/5K)', input: 10000, output: 5000 },
          { label: 'Heavy (100K/50K)', input: 100000, output: 50000 },
        ] as usage}
          <tr>
            <td style="padding: 0.75rem; border-bottom: 1px solid var(--ui);">{usage.label}</td>
            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid var(--ui);">
              <CostDisplay tokens={{ input: usage.input, output: usage.output }} pricing={haikuPricing} size="sm" />
            </td>
            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid var(--ui);">
              <CostDisplay tokens={{ input: usage.input, output: usage.output }} pricing={sonnetPricing} size="sm" />
            </td>
            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid var(--ui);">
              <CostDisplay tokens={{ input: usage.input, output: usage.output }} pricing={opusPricing} size="sm" />
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>
