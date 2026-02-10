<script lang="ts" module>
  export const meta = {
    title: 'TokenCounter',
    description: 'Display token counts with optional breakdown and limits',
    category: 'AI Components',
  };
</script>

<script lang="ts">
  import TokenCounter from './TokenCounter.svelte';
</script>

<section>
  <h3>Simple Count</h3>
  <div style="display: flex; gap: 2rem; align-items: center;">
    <TokenCounter tokens={1234} />
    <TokenCounter tokens={15000} />
    <TokenCounter tokens={1500000} />
  </div>
</section>

<section>
  <h3>With Breakdown</h3>
  <div style="display: flex; gap: 2rem; align-items: center;">
    <TokenCounter tokens={{ input: 500, output: 1200 }} showBreakdown />
    <TokenCounter tokens={{ input: 2048, output: 4096, total: 6144 }} showBreakdown />
  </div>
</section>

<section>
  <h3>With Limit</h3>
  <div style="display: flex; gap: 2rem; align-items: center;">
    <TokenCounter tokens={3000} limit={8000} />
    <TokenCounter tokens={6500} limit={8000} />
    <TokenCounter tokens={8500} limit={8000} />
  </div>
  <p style="margin-top: 0.5rem; font-size: var(--font-size-sm); color: var(--tx-3);">
    Normal (under 80%) → Warning (80-99%) → Error (100%+)
  </p>
</section>

<section>
  <h3>Near/Over Limit States</h3>
  <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 300px;">
    <div>
      <p style="margin: 0 0 0.25rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">50% usage</p>
      <TokenCounter tokens={2000} limit={4000} variant="detailed" />
    </div>
    <div>
      <p style="margin: 0 0 0.25rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">85% usage (warning)</p>
      <TokenCounter tokens={3400} limit={4000} variant="detailed" />
    </div>
    <div>
      <p style="margin: 0 0 0.25rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">105% usage (error)</p>
      <TokenCounter tokens={4200} limit={4000} variant="detailed" />
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
      <TokenCounter
        tokens={{ input: 1024, output: 2048 }}
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
      <TokenCounter
        tokens={{ input: 3500, output: 4000 }}
        limit={8192}
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
      <TokenCounter
        tokens={1500}
        limit={2000}
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
      <TokenCounter tokens={1234} size="sm" showBreakdown />
    </div>
    <div>
      <p style="margin: 0 0 0.25rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">Medium (default)</p>
      <TokenCounter tokens={1234} size="md" showBreakdown />
    </div>
  </div>
</section>

<section>
  <h3>Usage in Context</h3>
  <div style="
    max-width: 400px;
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
    ">
      <span style="font-family: var(--font-ui); color: var(--tx-2);">claude-opus-4-5-20251101</span>
      <TokenCounter tokens={{ input: 2500, output: 1200 }} size="sm" showBreakdown />
    </div>
    <div style="
      padding: 0.75rem;
      background: var(--bg);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-sm);
      color: var(--tx-2);
    ">
      Response content would appear here...
    </div>
  </div>
</section>
