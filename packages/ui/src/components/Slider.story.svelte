<script lang="ts" module>
  export const meta = {
    title: 'Slider',
    description: 'Range input with optional presets and value formatting',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import Slider from './Slider.svelte';

  let volume = $state(50);
  let temperature = $state(0.7);
  let tokens = $state(2048);
  let opacity = $state(100);
</script>

<section>
  <h3>Basic</h3>
  <div style="max-width: 400px;">
    <Slider bind:value={volume} label="Volume" />
  </div>
</section>

<section>
  <h3>With Presets</h3>
  <div style="max-width: 400px;">
    <Slider
      bind:value={temperature}
      label="Temperature"
      min={0}
      max={2}
      step={0.1}
      presets={[
        { value: 0, label: 'Precise' },
        { value: 0.7, label: 'Balanced' },
        { value: 1, label: 'Creative' },
        { value: 2, label: 'Random' },
      ]}
    />
  </div>
</section>

<section>
  <h3>Custom Formatter</h3>
  <div style="max-width: 400px; display: flex; flex-direction: column; gap: 1.5rem;">
    <Slider
      bind:value={tokens}
      label="Max Tokens"
      min={256}
      max={8192}
      step={256}
      formatValue={(v) => v.toLocaleString()}
      presets={[
        { value: 512, label: '512' },
        { value: 2048, label: '2K' },
        { value: 4096, label: '4K' },
        { value: 8192, label: '8K' },
      ]}
    />
    <Slider
      bind:value={opacity}
      label="Opacity"
      min={0}
      max={100}
      formatValue={(v) => `${v}%`}
    />
  </div>
</section>

<section>
  <h3>Different Ranges</h3>
  <div style="max-width: 400px; display: flex; flex-direction: column; gap: 1.5rem;">
    <Slider
      label="Small Range (1-10)"
      min={1}
      max={10}
      value={5}
    />
    <Slider
      label="Decimal Range (0.0-1.0)"
      min={0}
      max={1}
      step={0.01}
      value={0.5}
      formatValue={(v) => v.toFixed(2)}
    />
    <Slider
      label="Large Range (0-1000)"
      min={0}
      max={1000}
      step={10}
      value={500}
    />
  </div>
</section>

<section>
  <h3>Without Value Display</h3>
  <div style="max-width: 400px;">
    <Slider label="Brightness" showValue={false} value={75} />
  </div>
</section>

<section>
  <h3>Disabled</h3>
  <div style="max-width: 400px;">
    <Slider
      label="Locked Setting"
      value={60}
      disabled
      presets={[
        { value: 0, label: 'Low' },
        { value: 50, label: 'Medium' },
        { value: 100, label: 'High' },
      ]}
    />
  </div>
</section>

<section>
  <h3>Model Configuration Example</h3>
  <div style="
    max-width: 500px;
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    padding: 1.5rem;
  ">
    <h4 style="margin: 0 0 1.5rem 0; font-family: var(--font-ui); font-size: var(--text-panel-title-font-size);">
      Generation Settings
    </h4>
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <Slider
        label="Temperature"
        min={0}
        max={2}
        step={0.1}
        value={0.7}
        presets={[
          { value: 0, label: 'Deterministic' },
          { value: 1, label: 'Default' },
        ]}
      />
      <Slider
        label="Top P"
        min={0}
        max={1}
        step={0.05}
        value={0.9}
        formatValue={(v) => v.toFixed(2)}
      />
      <Slider
        label="Max Output Tokens"
        min={1}
        max={4096}
        step={1}
        value={1024}
        formatValue={(v) => v.toLocaleString()}
        presets={[
          { value: 256, label: '256' },
          { value: 1024, label: '1K' },
          { value: 4096, label: '4K' },
        ]}
      />
    </div>
  </div>
</section>
