<script lang="ts" module>
  export const meta = {
    title: 'LatencyBadge',
    description: 'Formatted response time display with color coding',
    category: 'AI Components',
  };
</script>

<script lang="ts">
  import LatencyBadge from './LatencyBadge.svelte';
</script>

<section>
  <h3>Status Colors</h3>
  <div style="display: flex; gap: 2rem; align-items: center;">
    <div style="display: flex; flex-direction: column; gap: 0.25rem; align-items: center;">
      <LatencyBadge ms={250} />
      <span style="font-size: var(--font-size-sm); color: var(--tx-3);">Good (&lt;500ms)</span>
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.25rem; align-items: center;">
      <LatencyBadge ms={1200} />
      <span style="font-size: var(--font-size-sm); color: var(--tx-3);">Fair (500-2000ms)</span>
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.25rem; align-items: center;">
      <LatencyBadge ms={3500} />
      <span style="font-size: var(--font-size-sm); color: var(--tx-3);">Poor (&gt;2000ms)</span>
    </div>
  </div>
</section>

<section>
  <h3>Format Examples</h3>
  <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
      <LatencyBadge ms={50} />
      <LatencyBadge ms={150} />
      <LatencyBadge ms={500} />
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
      <LatencyBadge ms={850} />
      <LatencyBadge ms={1500} />
      <LatencyBadge ms={2500} />
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
      <LatencyBadge ms={5000} />
      <LatencyBadge ms={10000} />
      <LatencyBadge ms={30000} />
    </div>
  </div>
  <p style="margin-top: 0.5rem; font-size: var(--font-size-sm); color: var(--tx-3);">
    Displays as "XXX ms" under 1000ms, then "X.Xs" format
  </p>
</section>

<section>
  <h3>Custom Thresholds</h3>
  <div style="display: flex; gap: 2rem;">
    <div>
      <p style="margin: 0 0 0.5rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">Default thresholds</p>
      <div style="display: flex; gap: 1rem;">
        <LatencyBadge ms={400} />
        <LatencyBadge ms={800} />
        <LatencyBadge ms={2500} />
      </div>
    </div>
    <div>
      <p style="margin: 0 0 0.5rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">Strict thresholds (200/1000)</p>
      <div style="display: flex; gap: 1rem;">
        <LatencyBadge ms={400} thresholds={{ good: 200, fair: 1000 }} />
        <LatencyBadge ms={800} thresholds={{ good: 200, fair: 1000 }} />
        <LatencyBadge ms={2500} thresholds={{ good: 200, fair: 1000 }} />
      </div>
    </div>
  </div>
</section>

<section>
  <h3>Sizes</h3>
  <div style="display: flex; gap: 2rem; align-items: center;">
    <div>
      <p style="margin: 0 0 0.25rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">Small</p>
      <LatencyBadge ms={450} size="sm" />
    </div>
    <div>
      <p style="margin: 0 0 0.25rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">Medium (default)</p>
      <LatencyBadge ms={450} size="md" />
    </div>
  </div>
</section>

<section>
  <h3>Without Unit</h3>
  <div style="display: flex; gap: 2rem; align-items: center;">
    <div>
      <p style="margin: 0 0 0.25rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">With unit (default)</p>
      <LatencyBadge ms={850} showUnit={true} />
    </div>
    <div>
      <p style="margin: 0 0 0.25rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">Without unit</p>
      <LatencyBadge ms={850} showUnit={false} />
    </div>
  </div>
</section>

<section>
  <h3>Usage in Context</h3>
  <div style="
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    max-width: 400px;
  ">
    <span style="font-family: var(--font-ui); color: var(--tx-2);">Response time:</span>
    <LatencyBadge ms={342} />
  </div>
</section>

<section>
  <h3>Model Comparison</h3>
  <div style="
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 300px;
  ">
    {#each [
      { model: 'claude-opus-4-5-20251101', ms: 2850 },
      { model: 'Claude 3.5 Sonnet', ms: 1200 },
      { model: 'Claude 3 Haiku', ms: 350 },
    ] as item}
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 0.75rem;
        background: var(--bg-2);
        border: 1px solid var(--ui);
        border-radius: var(--radius-sm);
      ">
        <span style="font-family: var(--font-ui); font-size: 0.875rem;">{item.model}</span>
        <LatencyBadge ms={item.ms} size="sm" />
      </div>
    {/each}
  </div>
</section>
