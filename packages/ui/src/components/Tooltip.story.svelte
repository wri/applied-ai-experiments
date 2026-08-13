<script lang="ts" module>
  export const meta = {
    title: 'Tooltip',
    description: 'Hover/focus tooltip with four positions',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import Tooltip from './Tooltip.svelte';
  import Button from './Button.svelte';
</script>

<section>
  <h3>Positions</h3>
  <div style="display: flex; gap: 2.5rem; padding: 3rem; flex-wrap: wrap;">
    <Tooltip text="Tooltip above" position="top">
      <Button variant="secondary">Top</Button>
    </Tooltip>
    <Tooltip text="Tooltip below" position="bottom">
      <Button variant="secondary">Bottom</Button>
    </Tooltip>
    <Tooltip text="Tooltip to the left" position="left">
      <Button variant="secondary">Left</Button>
    </Tooltip>
    <Tooltip text="Tooltip to the right" position="right">
      <Button variant="secondary">Right</Button>
    </Tooltip>
  </div>
</section>

<section>
  <h3>On an inline element (hover or Tab to focus)</h3>
  <p style="color: var(--tx-2); max-width: 480px;">
    Some metrics are
    <Tooltip text="Estimated from the prompt before the call — not billed.">
      <span style="text-decoration: underline dotted; cursor: help;">forecast</span>
    </Tooltip>
    rather than measured.
  </p>
</section>

<section>
  <h3>Rich content</h3>
  <div style="padding: 2rem;">
    <Tooltip position="bottom">
      {#snippet tip()}
        <strong>Latency</strong><br />time to first token, p50
      {/snippet}
      <Button variant="ghost" size="sm">Hover for detail</Button>
    </Tooltip>
  </div>
</section>
