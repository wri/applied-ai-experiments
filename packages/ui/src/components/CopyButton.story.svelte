<script lang="ts" module>
  export const meta = {
    title: 'CopyButton',
    description: 'Click to copy text with visual feedback',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import CopyButton from './CopyButton.svelte';
</script>

<section>
  <h3>Variants</h3>
  <div style="display: flex; gap: 1rem; align-items: center;">
    <CopyButton text="Primary variant" variant="primary" />
    <CopyButton text="Secondary variant" variant="secondary" />
    <CopyButton text="Ghost variant" variant="ghost" />
  </div>
</section>

<section>
  <h3>Sizes</h3>
  <div style="display: flex; gap: 1rem; align-items: center;">
    <CopyButton text="Small" size="sm" label="Small" />
    <CopyButton text="Medium" size="md" label="Medium" />
    <CopyButton text="Large" size="lg" label="Large" />
  </div>
</section>

<section>
  <h3>Icon Only</h3>
  <div style="display: flex; gap: 1rem; align-items: center;">
    <CopyButton text="Copy me!" size="sm" iconOnly />
    <CopyButton text="Copy me!" size="md" iconOnly />
    <CopyButton text="Copy me!" size="lg" iconOnly />
  </div>
  <p style="margin-top: 0.5rem; font-size: var(--font-size-sm); color: var(--tx-3);">
    Icon-only buttons show a tooltip on hover
  </p>
</section>

<section>
  <h3>Custom Labels</h3>
  <div style="display: flex; flex-direction: column; gap: 1rem;">
    <div style="display: flex; gap: 1rem; align-items: center;">
      <CopyButton text="https://example.com/api" label="Copy URL" successLabel="URL Copied!" />
      <CopyButton text="sk-abc123..." label="Copy Key" successLabel="Key Copied!" />
    </div>
  </div>
</section>

<section>
  <h3>Feedback Demo</h3>
  <p style="margin-bottom: 1rem; font-size: var(--font-size-sm); color: var(--tx-2);">
    Click to see the feedback animation. The button shows a checkmark for 2 seconds (configurable).
  </p>
  <div style="display: flex; gap: 1rem; align-items: center;">
    <CopyButton text="Short feedback" feedbackDuration={1000} label="1 second" />
    <CopyButton text="Normal feedback" feedbackDuration={2000} label="2 seconds" />
    <CopyButton text="Long feedback" feedbackDuration={4000} label="4 seconds" />
  </div>
</section>

<section>
  <h3>Code Block Example</h3>
  <div style="
    background: var(--bg-3);
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    overflow: hidden;
    max-width: 500px;
  ">
    <div style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0.75rem;
      background: var(--bg-2);
      border-bottom: 1px solid var(--ui);
    ">
      <span style="font-family: var(--font-ui); font-size: 0.75rem; color: var(--tx-3);">
        example.js
      </span>
      <CopyButton
        text={`const greeting = 'Hello, World!';\nconsole.log(greeting);`}
        size="sm"
        variant="ghost"
        iconOnly
      />
    </div>
    <pre style="
      margin: 0;
      padding: 1rem;
      font-family: var(--font-mono);
      font-size: 0.875rem;
      color: var(--tx);
      overflow-x: auto;
    "><code>const greeting = 'Hello, World!';
console.log(greeting);</code></pre>
  </div>
</section>

<section>
  <h3>API Key Display</h3>
  <div style="
    display: flex;
    align-items: center;
    gap: 0.75rem;
    max-width: 400px;
    padding: 0.75rem 1rem;
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
  ">
    <span style="
      flex: 1;
      font-family: var(--font-mono);
      font-size: var(--text-body-font-size);
      color: var(--tx-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    ">
      sk-ant-api03-xxxx...xxxx
    </span>
    <CopyButton
      text="sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      size="sm"
      variant="secondary"
      iconOnly
    />
  </div>
</section>

<section>
  <h3>Inline with Text</h3>
  <div style="display: flex; align-items: center; gap: 0.5rem;">
    <span style="font-family: var(--font-mono); color: var(--tx-2);">npm install @wri-datalab/ui</span>
    <CopyButton text="npm install @wri-datalab/ui" size="sm" variant="ghost" iconOnly />
  </div>
</section>
