<script lang="ts">
  interface Props {
    checked?: boolean;
    label?: string;
    labelPosition?: 'left' | 'right';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    id?: string;
    class?: string;
  }

  let {
    checked = $bindable(false),
    label,
    labelPosition = 'right',
    size = 'md',
    disabled = false,
    id,
    class: className = '',
  }: Props = $props();

  // Generate a stable random ID once, then derive the actual ID from props
  const randomId = `toggle-${Math.random().toString(36).slice(2, 9)}`;
  const toggleId = $derived(id || randomId);

  const sizeConfig = {
    sm: { track: { width: 32, height: 18 }, thumb: 14 },
    md: { track: { width: 44, height: 24 }, thumb: 20 },
    lg: { track: { width: 56, height: 30 }, thumb: 26 },
  };

  const config = $derived(sizeConfig[size]);
  const thumbOffset = $derived((config.track.height - config.thumb) / 2);
  const translateX = $derived(checked ? config.track.width - config.thumb - thumbOffset : thumbOffset);
</script>

<div
  class="ui-toggle {className}"
  class:label-left={labelPosition === 'left'}
>
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-labelledby={label ? `${toggleId}-label` : undefined}
    class="toggle-track"
    class:checked
    {disabled}
    onclick={() => { if (!disabled) checked = !checked; }}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!disabled) checked = !checked;
      }
    }}
    style="width: {config.track.width}px; height: {config.track.height}px;"
  >
    <span
      class="toggle-thumb"
      style="
        top: {thumbOffset}px;
        width: {config.thumb}px;
        height: {config.thumb}px;
        transform: translateX({translateX}px);
      "
    ></span>
  </button>
  {#if label}
    <span
      id="{toggleId}-label"
      class="toggle-label"
      class:disabled
      class:small={size === 'sm'}
    >
      {label}
    </span>
  {/if}
</div>

<style>
  .ui-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .ui-toggle.label-left {
    flex-direction: row-reverse;
  }

  .toggle-track {
    position: relative;
    border-radius: var(--radius-full);
    background-color: var(--ui);
    border: none;
    cursor: pointer;
    transition: background-color var(--transition-fast, 0.15s) ease;
    padding: 0;
    flex-shrink: 0;
  }

  .toggle-track.checked {
    background-color: var(--primary);
  }

  .toggle-track:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .toggle-track:focus-visible {
    outline: none;
    box-shadow: 0 0 0 var(--focus-ring-width, 2px) var(--focus-ring-color, var(--primary));
  }

  .toggle-thumb {
    position: absolute;
    left: 0;
    border-radius: var(--radius-full);
    background-color: white;
    transition: transform var(--transition-fast, 0.15s) ease;
    box-shadow: var(--shadow-sm);
  }

  .toggle-label {
    font-family: var(--font-ui);
    font-size: var(--text-body-font-size);
    color: var(--tx);
    cursor: pointer;
    user-select: none;
  }

  .toggle-label.small {
    font-size: var(--font-size-sm);
  }

  .toggle-label.disabled {
    color: var(--tx-3);
    cursor: not-allowed;
  }
</style>
