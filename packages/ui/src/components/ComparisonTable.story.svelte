<script lang="ts" module>
  export const meta = {
    title: 'ComparisonTable',
    description: 'Side-by-side comparison table with highlighting',
    category: 'AI Components',
  };
</script>

<script lang="ts">
  import ComparisonTable from './ComparisonTable.svelte';

  const modelColumns = [
    { id: 'haiku', label: 'Claude 3 Haiku' },
    { id: 'sonnet', label: 'Claude 3.5 Sonnet', highlight: true },
    { id: 'opus', label: 'claude-opus-4-5-20251101' },
  ];

  const modelRows = [
    {
      label: 'Input Price (per 1M)',
      values: { haiku: '$0.25', sonnet: '$3', opus: '$15' },
    },
    {
      label: 'Output Price (per 1M)',
      values: { haiku: '$1.25', sonnet: '$15', opus: '$75' },
    },
    {
      label: 'Context Window',
      values: { haiku: 200000, sonnet: 200000, opus: 200000 },
      format: (v: number) => `${(v / 1000)}K`,
    },
    {
      label: 'Speed',
      values: { haiku: 'fastest', sonnet: 'fast', opus: 'moderate' },
      sentiment: (v: string) => v === 'fastest' ? 'positive' : v === 'fast' ? 'neutral' : 'negative',
    },
    {
      label: 'Vision',
      values: { haiku: true, sonnet: true, opus: true },
    },
    {
      label: 'Tool Use',
      values: { haiku: true, sonnet: true, opus: true },
    },
  ];

  const featureColumns = [
    { id: 'free', label: 'Free' },
    { id: 'pro', label: 'Pro', highlight: true },
    { id: 'enterprise', label: 'Enterprise' },
  ];

  const featureRows = [
    {
      label: 'API Access',
      values: { free: true, pro: true, enterprise: true },
    },
    {
      label: 'Rate Limit',
      values: { free: '10/min', pro: '100/min', enterprise: 'Unlimited' },
    },
    {
      label: 'Daily Tokens',
      values: { free: 100000, pro: 1000000, enterprise: 'Unlimited' },
      format: (v: number | string) => typeof v === 'number' ? `${(v / 1000)}K` : v,
    },
    {
      label: 'Priority Support',
      values: { free: false, pro: true, enterprise: true },
    },
    {
      label: 'Custom Models',
      values: { free: false, pro: false, enterprise: true },
    },
    {
      label: 'SSO',
      values: { free: false, pro: false, enterprise: true },
    },
  ];

  const metricsColumns = [
    { id: 'baseline', label: 'Baseline' },
    { id: 'v2', label: 'v2.0' },
    { id: 'v3', label: 'v3.0', highlight: true },
  ];

  const metricsRows = [
    {
      label: 'Accuracy',
      values: { baseline: 0.82, v2: 0.89, v3: 0.94 },
      format: (v: number) => `${(v * 100).toFixed(0)}%`,
      sentiment: (v: number) => v >= 0.9 ? 'positive' : v >= 0.85 ? 'neutral' : 'negative',
    },
    {
      label: 'Latency (p50)',
      values: { baseline: 450, v2: 320, v3: 180 },
      format: (v: number) => `${v}ms`,
      sentiment: (v: number) => v <= 200 ? 'positive' : v <= 400 ? 'neutral' : 'negative',
    },
    {
      label: 'Latency (p99)',
      values: { baseline: 1200, v2: 850, v3: 420 },
      format: (v: number) => `${v}ms`,
      sentiment: (v: number) => v <= 500 ? 'positive' : v <= 1000 ? 'neutral' : 'negative',
    },
    {
      label: 'Throughput',
      values: { baseline: 100, v2: 250, v3: 500 },
      format: (v: number) => `${v} req/s`,
      sentiment: (v: number) => v >= 400 ? 'positive' : v >= 200 ? 'neutral' : 'negative',
    },
    {
      label: 'Error Rate',
      values: { baseline: 0.05, v2: 0.02, v3: 0.005 },
      format: (v: number) => `${(v * 100).toFixed(1)}%`,
      sentiment: (v: number) => v <= 0.01 ? 'positive' : v <= 0.03 ? 'neutral' : 'negative',
    },
  ];
</script>

<section>
  <h3>Model Comparison</h3>
  <ComparisonTable
    title="Claude Model Comparison"
    columns={modelColumns}
    rows={modelRows}
  />
</section>

<section>
  <h3>Feature Matrix</h3>
  <ComparisonTable
    title="Pricing Plans"
    columns={featureColumns}
    rows={featureRows}
  />
</section>

<section>
  <h3>Metrics Comparison</h3>
  <ComparisonTable
    title="Performance Benchmarks"
    columns={metricsColumns}
    rows={metricsRows}
  />
</section>

<section>
  <h3>Highlighted Winner</h3>
  <p style="margin-bottom: 1rem; font-size: var(--font-size-sm); color: var(--tx-2);">
    The highlighted column is styled with a subtle primary color background and "Recommended" label.
  </p>
  <ComparisonTable
    columns={[
      { id: 'a', label: 'Option A' },
      { id: 'b', label: 'Option B', highlight: true },
      { id: 'c', label: 'Option C' },
    ]}
    rows={[
      { label: 'Price', values: { a: '$99', b: '$149', c: '$299' } },
      { label: 'Features', values: { a: 'Basic', b: 'Advanced', c: 'Premium' } },
      { label: 'Support', values: { a: 'Email', b: '24/7 Chat', c: 'Dedicated' } },
    ]}
  />
</section>

<section>
  <h3>Without Title</h3>
  <ComparisonTable
    columns={[
      { id: 'react', label: 'React' },
      { id: 'svelte', label: 'Svelte', highlight: true },
      { id: 'vue', label: 'Vue' },
    ]}
    rows={[
      { label: 'Bundle Size', values: { react: '42KB', svelte: '1.6KB', vue: '33KB' } },
      { label: 'Learning Curve', values: { react: 'Medium', svelte: 'Easy', vue: 'Easy' } },
      { label: 'Virtual DOM', values: { react: true, svelte: false, vue: true } },
    ]}
  />
</section>

<section>
  <h3>Wide Table (Horizontal Scroll)</h3>
  <div style="max-width: 500px;">
    <ComparisonTable
      title="Extended Comparison"
      columns={[
        { id: 'a', label: 'Model A' },
        { id: 'b', label: 'Model B' },
        { id: 'c', label: 'Model C', highlight: true },
        { id: 'd', label: 'Model D' },
        { id: 'e', label: 'Model E' },
      ]}
      rows={[
        { label: 'Parameter Count', values: { a: '7B', b: '13B', c: '70B', d: '175B', e: '540B' } },
        { label: 'Training Data', values: { a: '1T', b: '1.5T', c: '2T', d: '3T', e: '5T' } },
        { label: 'Release Date', values: { a: '2023', b: '2023', c: '2024', d: '2024', e: '2025' } },
      ]}
    />
  </div>
</section>
