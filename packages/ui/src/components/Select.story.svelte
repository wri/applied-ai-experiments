<script lang="ts" module>
  export const meta = {
    title: 'Select',
    description: 'Dropdown select input with label and validation',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import Select from './Select.svelte';

  let provider = $state('');
  let model = $state('gpt-4');

  const providers = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'google', label: 'Google AI' },
    { value: 'groq', label: 'Groq' },
  ];

  const models = [
    { value: 'gpt-4', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5', label: 'GPT-3.5 Turbo' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'legacy', label: 'GPT-3 (Legacy)', disabled: true },
  ];
</script>

<section>
  <h3>Basic</h3>
  <div style="max-width: 300px;">
    <Select
      options={providers}
      bind:value={provider}
      placeholder="Select a provider"
    />
    <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; color: var(--tx-3);">
      Selected: {provider || '(none)'}
    </p>
  </div>
</section>

<section>
  <h3>With Label</h3>
  <div style="max-width: 300px;">
    <Select
      label="Model"
      options={models}
      bind:value={model}
      placeholder="Choose a model"
    />
  </div>
</section>

<section>
  <h3>With Hint</h3>
  <div style="max-width: 300px;">
    <Select
      label="Region"
      options={[
        { value: 'us-east', label: 'US East' },
        { value: 'us-west', label: 'US West' },
        { value: 'eu-west', label: 'EU West' },
      ]}
      hint="Select the region closest to your users"
    />
  </div>
</section>

<section>
  <h3>Error State</h3>
  <div style="max-width: 300px;">
    <Select
      label="Database"
      options={[
        { value: '', label: '' },
        { value: 'postgres', label: 'PostgreSQL' },
        { value: 'mysql', label: 'MySQL' },
      ]}
      error="Database selection is required"
    />
  </div>
</section>

<section>
  <h3>Disabled Options</h3>
  <div style="max-width: 300px;">
    <Select
      label="Model"
      options={models}
      hint="Some models are deprecated and cannot be selected"
    />
  </div>
</section>

<section>
  <h3>Disabled Select</h3>
  <div style="max-width: 300px;">
    <Select
      label="Locked Selection"
      options={providers}
      value="openai"
      disabled
    />
  </div>
</section>
