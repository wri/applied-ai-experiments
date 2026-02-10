<script lang="ts" module>
  export const meta = {
    title: 'Button',
    description: 'Action button with variants, sizes, and loading state',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import Button from './Button.svelte';

  let loading = $state(false);

  function simulateLoading() {
    loading = true;
    setTimeout(() => { loading = false; }, 2000);
  }
</script>

<section>
  <h3>Variants</h3>
  <div class="story-row">
    <Button variant="primary">Primary</Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="danger">Danger</Button>
  </div>
</section>

<section>
  <h3>Sizes</h3>
  <div class="story-row">
    <Button size="sm">Small</Button>
    <Button size="md">Medium</Button>
    <Button size="lg">Large</Button>
  </div>
</section>

<section>
  <h3>Disabled State</h3>
  <div class="story-row">
    <Button variant="primary" disabled>Disabled Primary</Button>
    <Button variant="secondary" disabled>Disabled Secondary</Button>
    <Button variant="ghost" disabled>Disabled Ghost</Button>
    <Button variant="danger" disabled>Disabled Danger</Button>
  </div>
</section>

<section>
  <h3>Loading State</h3>
  <div class="story-row">
    <Button variant="primary" {loading} onclick={simulateLoading}>
      {loading ? 'Processing...' : 'Click to Load'}
    </Button>
    <Button variant="secondary" loading>Loading</Button>
    <Button variant="danger" loading>Deleting...</Button>
  </div>
</section>

<section>
  <h3>Full Width</h3>
  <div style="max-width: 300px;">
    <Button variant="primary" style="width: 100%;">Full Width Button</Button>
  </div>
</section>
