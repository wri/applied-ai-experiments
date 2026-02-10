<script lang="ts" module>
  export const meta = {
    title: 'Input',
    description: 'Text input with label, hint, and error states',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import Input from './Input.svelte';

  let value = $state('');
  let email = $state('');
  let password = $state('');
</script>

<section>
  <h3>Basic</h3>
  <div style="max-width: 300px;">
    <Input bind:value placeholder="Enter text..." />
    <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; color: var(--tx-3);">
      Current value: {value || '(empty)'}
    </p>
  </div>
</section>

<section>
  <h3>With Label</h3>
  <div style="max-width: 300px; display: flex; flex-direction: column; gap: 1rem;">
    <Input label="Username" placeholder="Enter username" />
    <Input label="Email" type="email" bind:value={email} placeholder="you@example.com" />
    <Input label="Password" type="password" bind:value={password} placeholder="Enter password" />
  </div>
</section>

<section>
  <h3>With Hint</h3>
  <div style="max-width: 300px;">
    <Input
      label="API Key"
      placeholder="sk-..."
      hint="You can find your API key in your account settings"
    />
  </div>
</section>

<section>
  <h3>Error State</h3>
  <div style="max-width: 300px; display: flex; flex-direction: column; gap: 1rem;">
    <Input
      label="Email"
      value="invalid-email"
      error="Please enter a valid email address"
    />
    <Input
      label="Username"
      value="ab"
      error="Username must be at least 3 characters"
    />
  </div>
</section>

<section>
  <h3>Disabled</h3>
  <div style="max-width: 300px;">
    <Input
      label="Locked Field"
      value="Cannot be changed"
      disabled
    />
  </div>
</section>

<section>
  <h3>Various Types</h3>
  <div style="max-width: 300px; display: flex; flex-direction: column; gap: 1rem;">
    <Input label="Number" type="number" placeholder="0" />
    <Input label="Date" type="date" />
    <Input label="URL" type="url" placeholder="https://example.com" />
  </div>
</section>
