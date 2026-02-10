<script lang="ts" module>
  export const meta = {
    title: 'Card',
    description: 'Container component with configurable padding',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import Card from './Card.svelte';
  import Button from './Button.svelte';
  import Badge from './Badge.svelte';
</script>

<section>
  <h3>Padding Sizes</h3>
  <div class="story-grid">
    <Card padding="sm">
      <p style="margin: 0; color: var(--tx-2);">Small padding</p>
    </Card>
    <Card padding="md">
      <p style="margin: 0; color: var(--tx-2);">Medium padding (default)</p>
    </Card>
    <Card padding="lg">
      <p style="margin: 0; color: var(--tx-2);">Large padding</p>
    </Card>
  </div>
</section>

<section>
  <h3>With Content</h3>
  <div style="max-width: 400px;">
    <Card>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
        <div>
          <h4 style="margin: 0 0 0.25rem 0; font-family: var(--font-mono); color: var(--tx);">Experiment #042</h4>
          <p style="margin: 0; font-size: 0.875rem; color: var(--tx-3);">Vision Model Benchmark</p>
        </div>
        <Badge variant="success">Running</Badge>
      </div>
      <p style="margin: 0 0 1rem 0; color: var(--tx-2); font-size: 0.875rem;">
        Testing GPT-4V performance on scientific image classification across 10,000 samples.
      </p>
      <div style="display: flex; gap: 0.5rem;">
        <Button variant="secondary" size="sm">View Details</Button>
        <Button variant="ghost" size="sm">Stop</Button>
      </div>
    </Card>
  </div>
</section>

<section>
  <h3>Card Grid</h3>
  <div class="story-grid">
    <Card>
      <h4 style="margin: 0 0 0.5rem 0; font-family: var(--font-mono); color: var(--tx);">Models</h4>
      <p style="margin: 0; color: var(--tx-2); font-size: 0.875rem;">3 active</p>
    </Card>
    <Card>
      <h4 style="margin: 0 0 0.5rem 0; font-family: var(--font-mono); color: var(--tx);">Datasets</h4>
      <p style="margin: 0; color: var(--tx-2); font-size: 0.875rem;">12 loaded</p>
    </Card>
    <Card>
      <h4 style="margin: 0 0 0.5rem 0; font-family: var(--font-mono); color: var(--tx);">Jobs</h4>
      <p style="margin: 0; color: var(--tx-2); font-size: 0.875rem;">2 running</p>
    </Card>
  </div>
</section>
