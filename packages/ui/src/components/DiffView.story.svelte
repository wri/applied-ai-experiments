<script lang="ts" module>
  export const meta = {
    title: 'DiffView',
    description: 'Side-by-side or unified text comparison view',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import DiffView from './DiffView.svelte';

  const oldCode = `function greet(name) {
  console.log("Hello, " + name);
  return true;
}`;

  const newCode = `function greet(name, greeting = "Hello") {
  console.log(greeting + ", " + name + "!");
  return { success: true, name };
}`;

  const oldProse = `The quick brown fox jumps over the lazy dog.
This is a sample paragraph that will be modified.
Some lines will stay the same.
Other lines will be removed.`;

  const newProse = `The quick brown fox leaps over the lazy dog.
This is an updated paragraph with new content.
Some lines will stay the same.
New lines have been added here.
And here as well.`;

  const oldConfig = `{
  "name": "my-app",
  "version": "1.0.0",
  "dependencies": {
    "react": "^17.0.0"
  }
}`;

  const newConfig = `{
  "name": "my-app",
  "version": "1.1.0",
  "dependencies": {
    "react": "^18.0.0",
    "typescript": "^5.0.0"
  }
}`;

  const identicalText = `Line 1
Line 2
Line 3`;

  let mode: 'unified' | 'split' = $state('unified');
</script>

<section>
  <h3>Unified Mode (Default)</h3>
  <DiffView oldText={oldCode} newText={newCode} mode="unified" />
</section>

<section>
  <h3>Split Mode</h3>
  <DiffView oldText={oldCode} newText={newCode} mode="split" />
</section>

<section>
  <h3>Code Diff</h3>
  <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
    <button
      type="button"
      onclick={() => { mode = 'unified'; }}
      style="
        padding: 0.5rem 1rem;
        font-family: var(--font-ui);
        font-size: 0.75rem;
        background: {mode === 'unified' ? 'var(--primary)' : 'var(--bg-3)'};
        color: {mode === 'unified' ? 'var(--primary-content)' : 'var(--tx)'};
        border: 1px solid {mode === 'unified' ? 'var(--primary)' : 'var(--ui)'};
        border-radius: var(--radius-sm);
        cursor: pointer;
      "
    >
      Unified
    </button>
    <button
      type="button"
      onclick={() => { mode = 'split'; }}
      style="
        padding: 0.5rem 1rem;
        font-family: var(--font-ui);
        font-size: 0.75rem;
        background: {mode === 'split' ? 'var(--primary)' : 'var(--bg-3)'};
        color: {mode === 'split' ? 'var(--primary-content)' : 'var(--tx)'};
        border: 1px solid {mode === 'split' ? 'var(--primary)' : 'var(--ui)'};
        border-radius: var(--radius-sm);
        cursor: pointer;
      "
    >
      Split
    </button>
  </div>
  <DiffView
    oldText={oldCode}
    newText={newCode}
    oldLabel="version 1.0"
    newLabel="version 1.1"
    {mode}
  />
</section>

<section>
  <h3>Prose Diff</h3>
  <DiffView
    oldText={oldProse}
    newText={newProse}
    oldLabel="Original"
    newLabel="Revised"
    mode="split"
  />
</section>

<section>
  <h3>Config File Diff</h3>
  <DiffView
    oldText={oldConfig}
    newText={newConfig}
    oldLabel="package.json (old)"
    newLabel="package.json (new)"
    mode="unified"
  />
</section>

<section>
  <h3>No Changes</h3>
  <DiffView
    oldText={identicalText}
    newText={identicalText}
    mode="unified"
  />
</section>

<section>
  <h3>Without Line Numbers</h3>
  <DiffView
    oldText={oldCode}
    newText={newCode}
    showLineNumbers={false}
    mode="unified"
  />
</section>

<section>
  <h3>Complete Replacement</h3>
  <DiffView
    oldText="Old content that will be entirely replaced."
    newText="Completely new content with different structure."
    mode="split"
  />
</section>
