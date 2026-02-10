<script lang="ts" module>
  export const meta = {
    title: 'Spinner',
    description: 'Loading indicator with configurable sizes',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import Spinner from './Spinner.svelte';
</script>

<section>
  <h3>Sizes</h3>
  <div class="story-row" style="align-items: center;">
    <div style="text-align: center;">
      <Spinner size="sm" />
      <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; color: var(--tx-3);">Small</p>
    </div>
    <div style="text-align: center;">
      <Spinner size="md" />
      <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; color: var(--tx-3);">Medium</p>
    </div>
    <div style="text-align: center;">
      <Spinner size="lg" />
      <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; color: var(--tx-3);">Large</p>
    </div>
  </div>
</section>

<section>
  <h3>In Context</h3>
  <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 300px;">
    <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--tx-2);">
      <Spinner size="sm" />
      <span>Loading data...</span>
    </div>
    <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--tx-2);">
      <Spinner size="sm" />
      <span>Processing request...</span>
    </div>
  </div>
</section>

<section>
  <h3>Centered Loading State</h3>
  <div style="
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    background-color: var(--bg-2);
    border-radius: 0.25rem;
    max-width: 300px;
  ">
    <Spinner size="lg" />
    <p style="margin: 1rem 0 0 0; color: var(--tx-2); font-family: var(--font-mono); font-size: 0.875rem;">
      Generating response...
    </p>
  </div>
</section>
