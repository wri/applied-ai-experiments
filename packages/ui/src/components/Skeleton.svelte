<script lang="ts">
  interface Props {
    variant?: 'text' | 'circular' | 'rectangular';
    width?: string;
    height?: string;
    lines?: number;
    animate?: boolean;
    class?: string;
  }

  let {
    variant = 'text',
    width,
    height,
    lines = 1,
    animate = true,
    class: className = '',
  }: Props = $props();

  // Default dimensions based on variant
  const defaultDimensions = {
    text: { width: '100%', height: '1em' },
    circular: { width: '40px', height: '40px' },
    rectangular: { width: '100%', height: '100px' },
  };

  const finalWidth = $derived(width || defaultDimensions[variant].width);
  const finalHeight = $derived(height || defaultDimensions[variant].height);

  // Generate line widths for text variant
  function getLineWidth(index: number, total: number): string {
    if (total === 1) return '100%';
    // Last line is typically shorter
    if (index === total - 1) return '60%';
    // Vary other lines slightly
    return `${85 + (index % 3) * 5}%`;
  }
</script>

{#if variant === 'text' && lines > 1}
  <div class="ui-skeleton-group {className}" style="display: flex; flex-direction: column; gap: 0.5rem;">
    {#each Array(lines) as _, i}
      <div
        class="ui-skeleton"
        class:animate
        style="
          width: {getLineWidth(i, lines)};
          height: {finalHeight};
          background-color: var(--bg-3);
          border-radius: var(--radius-sm);
        "
      ></div>
    {/each}
  </div>
{:else}
  <div
    class="ui-skeleton {className}"
    class:animate
    style="
      width: {finalWidth};
      height: {finalHeight};
      background-color: var(--bg-3);
      border-radius: {variant === 'circular' ? '50%' : 'var(--radius-sm)'};
    "
  ></div>
{/if}

<style>
  .ui-skeleton {
    position: relative;
    overflow: hidden;
  }

  .ui-skeleton.animate::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      90deg,
      transparent,
      oklch(from var(--tx) l c h / 0.05),
      transparent
    );
    animation: shimmer 1.5s infinite;
  }

  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-skeleton.animate::after {
      animation: none;
    }
  }
</style>
