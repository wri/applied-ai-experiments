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
  style="
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    flex-direction: {labelPosition === 'left' ? 'row-reverse' : 'row'};
  "
>
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-labelledby={label ? `${toggleId}-label` : undefined}
    {disabled}
    onclick={() => { if (!disabled) checked = !checked; }}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!disabled) checked = !checked;
      }
    }}
    style="
      position: relative;
      width: {config.track.width}px;
      height: {config.track.height}px;
      border-radius: var(--radius-full);
      background-color: {checked ? 'var(--primary)' : 'var(--ui)'};
      border: none;
      cursor: {disabled ? 'not-allowed' : 'pointer'};
      opacity: {disabled ? 0.5 : 1};
      transition: background-color var(--transition-fast) ease;
      padding: 0;
      flex-shrink: 0;
    "
    onfocus={(e) => {
      e.currentTarget.style.outline = 'none';
      e.currentTarget.style.boxShadow = `0 0 0 var(--focus-ring-width) var(--focus-ring-color)`;
    }}
    onblur={(e) => {
      e.currentTarget.style.boxShadow = 'none';
    }}
  >
    <span
      style="
        position: absolute;
        top: {thumbOffset}px;
        left: 0;
        width: {config.thumb}px;
        height: {config.thumb}px;
        border-radius: var(--radius-full);
        background-color: white;
        transform: translateX({translateX}px);
        transition: transform var(--transition-fast) ease;
        box-shadow: var(--shadow-sm);
      "
    ></span>
  </button>
  {#if label}
    <span
      id="{toggleId}-label"
      style="
        font-family: var(--font-ui);
        font-size: {size === 'sm' ? 'var(--font-size-sm)' : 'var(--text-body-font-size)'};
        color: {disabled ? 'var(--tx-3)' : 'var(--tx)'};
        cursor: {disabled ? 'not-allowed' : 'pointer'};
        user-select: none;
      "
    >
      {label}
    </span>
  {/if}
</div>
