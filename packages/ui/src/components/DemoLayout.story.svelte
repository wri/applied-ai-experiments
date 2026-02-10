<script lang="ts" module>
  export const meta = {
    title: 'DemoLayout',
    description: 'Full page layout with header and footer',
    category: 'Layout',
  };
</script>

<script lang="ts">
  import DemoHeader from './DemoHeader.svelte';
  import DemoFooter from './DemoFooter.svelte';
  import Button from './Button.svelte';
</script>

<section>
  <h3>Header Only</h3>
  <div style="border: 1px solid var(--ui); border-radius: 0.25rem; overflow: hidden;">
    <DemoHeader title="Text Classifier" subtitle="Classify text using AI models" />
  </div>
</section>

<section>
  <h3>Header with Custom Actions</h3>
  <div style="border: 1px solid var(--ui); border-radius: 0.25rem; overflow: hidden;">
    <DemoHeader title="Image Analyzer">
      {#snippet actions()}
        <Button variant="primary" size="sm">Upload</Button>
      {/snippet}
    </DemoHeader>
  </div>
</section>

<section>
  <h3>Footer Only</h3>
  <div style="border: 1px solid var(--ui); border-radius: 0.25rem; overflow: hidden;">
    <DemoFooter />
  </div>
</section>

<section>
  <h3>Footer with Custom Content</h3>
  <div style="border: 1px solid var(--ui); border-radius: 0.25rem; overflow: hidden;">
    <DemoFooter>
      <span>Version 1.0.0 | Last updated: January 2025</span>
    </DemoFooter>
  </div>
</section>

<section>
  <h3>Max Width Options</h3>
  <div style="display: flex; flex-direction: column; gap: 1rem;">
    <div style="border: 1px solid var(--ui); border-radius: 0.25rem; overflow: hidden;">
      <DemoHeader title="Small (sm)" maxWidth="sm" />
    </div>
    <div style="border: 1px solid var(--ui); border-radius: 0.25rem; overflow: hidden;">
      <DemoHeader title="Medium (md)" maxWidth="md" />
    </div>
    <div style="border: 1px solid var(--ui); border-radius: 0.25rem; overflow: hidden;">
      <DemoHeader title="Large (lg)" maxWidth="lg" />
    </div>
  </div>
</section>

<section>
  <h3>Usage Note</h3>
  <div style="
    padding: 1rem;
    background-color: var(--info-subtle);
    border: 1px solid var(--info);
    border-radius: 0.25rem;
    color: var(--info-text);
    font-size: 0.875rem;
  ">
    <p style="margin: 0 0 0.5rem 0; font-weight: 600;">Full Layout Demo</p>
    <p style="margin: 0;">
      The <code style="background: var(--bg-3); padding: 0.125rem 0.25rem; border-radius: 0.125rem;">DemoLayout</code>
      component combines header, main content, and footer into a full-page layout.
      It's best viewed in a full-page context rather than embedded in a story.
    </p>
  </div>
</section>
