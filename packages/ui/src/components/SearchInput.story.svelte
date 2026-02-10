<script lang="ts" module>
  export const meta = {
    title: 'SearchInput',
    description: 'Search input with clear button and keyboard shortcuts',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import SearchInput from './SearchInput.svelte';

  let query = $state('');
  let query2 = $state('');
</script>

<section>
  <h3>Basic</h3>
  <div style="max-width: 300px;">
    <SearchInput bind:value={query} />
    <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; color: var(--tx-3);">
      Value: "{query}"
    </p>
  </div>
</section>

<section>
  <h3>Custom Placeholder</h3>
  <div style="max-width: 300px;">
    <SearchInput placeholder="Find components..." bind:value={query2} />
  </div>
</section>

<section>
  <h3>With Initial Value</h3>
  <div style="max-width: 300px;">
    <SearchInput value="button variants" />
    <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; color: var(--tx-3);">
      Click the X or press Escape to clear
    </p>
  </div>
</section>

<section>
  <h3>Disabled</h3>
  <div style="max-width: 300px;">
    <SearchInput value="locked search" disabled />
  </div>
</section>

<section>
  <h3>Different Widths</h3>
  <div style="display: flex; flex-direction: column; gap: 1rem;">
    <div style="width: 200px;">
      <SearchInput placeholder="Narrow..." />
    </div>
    <div style="width: 350px;">
      <SearchInput placeholder="Medium width..." />
    </div>
    <div style="width: 100%; max-width: 500px;">
      <SearchInput placeholder="Full width search..." />
    </div>
  </div>
</section>
