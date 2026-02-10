<script lang="ts" module>
  export const meta = {
    title: 'Badge',
    description: 'Small status indicators and labels',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import Badge from './Badge.svelte';
</script>

<section>
  <h3>Variants</h3>
  <div class="story-row">
    <Badge variant="default">Default</Badge>
    <Badge variant="success">Success</Badge>
    <Badge variant="warning">Warning</Badge>
    <Badge variant="error">Error</Badge>
    <Badge variant="info">Info</Badge>
  </div>
</section>

<section>
  <h3>Use Cases</h3>
  <div class="story-row">
    <Badge variant="success">Active</Badge>
    <Badge variant="warning">Pending</Badge>
    <Badge variant="error">Failed</Badge>
    <Badge variant="info">Beta</Badge>
    <Badge variant="default">v1.2.3</Badge>
  </div>
</section>

<section>
  <h3>In Context</h3>
  <div style="display: flex; flex-direction: column; gap: 0.75rem;">
    <div style="display: flex; align-items: center; gap: 0.5rem;">
      <span style="font-family: var(--font-mono); color: var(--tx);">API Status:</span>
      <Badge variant="success">Online</Badge>
    </div>
    <div style="display: flex; align-items: center; gap: 0.5rem;">
      <span style="font-family: var(--font-mono); color: var(--tx);">Build:</span>
      <Badge variant="warning">In Progress</Badge>
    </div>
    <div style="display: flex; align-items: center; gap: 0.5rem;">
      <span style="font-family: var(--font-mono); color: var(--tx);">Feature:</span>
      <Badge variant="info">Experimental</Badge>
    </div>
  </div>
</section>
