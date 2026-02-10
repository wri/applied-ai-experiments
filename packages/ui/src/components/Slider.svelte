<script lang="ts">
  interface Preset {
    value: number;
    label: string;
  }

  interface Props {
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    presets?: Preset[];
    formatValue?: (v: number) => string;
    showValue?: boolean;
    disabled?: boolean;
    id?: string;
    class?: string;
  }

  let {
    value = $bindable(0),
    min = 0,
    max = 100,
    step = 1,
    label,
    presets,
    formatValue = (v) => String(v),
    showValue = true,
    disabled = false,
    id,
    class: className = '',
  }: Props = $props();

  // Generate a stable random ID once, then derive the actual ID from props
  const randomId = `slider-${Math.random().toString(36).slice(2, 9)}`;
  const sliderId = $derived(id || randomId);

  // Calculate fill percentage
  const fillPercent = $derived(((value - min) / (max - min)) * 100);
</script>

<div class="ui-slider {className}">
  {#if label || showValue}
    <div style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    ">
      {#if label}
        <label
          for={sliderId}
          style="
            font-family: var(--text-label-font-family);
            font-size: var(--text-label-font-size);
            font-weight: var(--text-label-font-weight);
            letter-spacing: var(--text-label-letter-spacing);
            text-transform: var(--text-label-text-transform);
            color: var(--text-label-color);
          "
        >
          {label}
        </label>
      {:else}
        <span></span>
      {/if}
      {#if showValue}
        <span style="
          font-family: var(--font-mono);
          font-size: var(--text-body-font-size);
          color: var(--tx);
          font-variant-numeric: tabular-nums;
        ">
          {formatValue(value)}
        </span>
      {/if}
    </div>
  {/if}

  <div style="position: relative;">
    <input
      type="range"
      id={sliderId}
      bind:value
      {min}
      {max}
      {step}
      {disabled}
      style="
        width: 100%;
        height: 6px;
        appearance: none;
        background: linear-gradient(to right, var(--primary) {fillPercent}%, var(--bg-3) {fillPercent}%);
        border-radius: var(--radius-full);
        cursor: {disabled ? 'not-allowed' : 'pointer'};
        opacity: {disabled ? 0.5 : 1};
      "
    />
  </div>

  {#if presets && presets.length > 0}
    <div style="
      display: flex;
      gap: 0.5rem;
      margin-top: 0.75rem;
      flex-wrap: wrap;
    ">
      {#each presets as preset}
        <button
          type="button"
          onclick={() => { if (!disabled) value = preset.value; }}
          disabled={disabled}
          style="
            padding: 0.25rem 0.75rem;
            font-family: var(--font-ui);
            font-size: 0.75rem;
            background: {value === preset.value ? 'var(--primary)' : 'var(--bg-3)'};
            color: {value === preset.value ? 'var(--primary-content)' : 'var(--tx)'};
            border: 1px solid {value === preset.value ? 'var(--primary)' : 'var(--ui)'};
            border-radius: var(--radius-full);
            cursor: {disabled ? 'not-allowed' : 'pointer'};
            opacity: {disabled ? 0.5 : 1};
            transition: all var(--transition-fast) ease;
          "
        >
          {preset.label}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    background: var(--primary);
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid var(--bg);
    box-shadow: var(--shadow-sm);
  }

  input[type="range"]::-moz-range-thumb {
    width: 18px;
    height: 18px;
    background: var(--primary);
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid var(--bg);
    box-shadow: var(--shadow-sm);
  }

  input[type="range"]:focus {
    outline: none;
  }

  input[type="range"]:focus::-webkit-slider-thumb {
    box-shadow: 0 0 0 var(--focus-ring-width) var(--focus-ring-color);
  }

  input[type="range"]:focus::-moz-range-thumb {
    box-shadow: 0 0 0 var(--focus-ring-width) var(--focus-ring-color);
  }

  input[type="range"]:disabled::-webkit-slider-thumb {
    cursor: not-allowed;
  }

  input[type="range"]:disabled::-moz-range-thumb {
    cursor: not-allowed;
  }
</style>
