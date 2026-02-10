<script lang="ts">
  import type { Snippet } from 'svelte';

  const isBrowser = typeof window !== 'undefined';

  interface Props {
    open?: boolean;
    position?: 'bottom-left' | 'bottom-right' | 'bottom-center';
    anchorElement?: HTMLElement | null;
    onclickoutside?: () => void;
    children: Snippet;
  }

  let {
    open = false,
    position = 'bottom-right',
    anchorElement = null,
    onclickoutside,
    children,
  }: Props = $props();

  let popoverRef: HTMLDivElement | null = $state(null);
  let positionStyle = $state('');

  function updatePosition() {
    if (!anchorElement || !popoverRef) return;

    const rect = anchorElement.getBoundingClientRect();
    const popoverRect = popoverRef.getBoundingClientRect();

    let top = rect.bottom + 8;
    let left: number | undefined;
    let right: number | undefined;

    if (position === 'bottom-right') {
      right = window.innerWidth - rect.right;
    } else if (position === 'bottom-left') {
      left = rect.left;
    } else {
      // bottom-center
      left = rect.left + (rect.width / 2) - (popoverRect.width / 2);
    }

    // Ensure popover stays within viewport
    if (left !== undefined && left < 8) left = 8;
    if (right !== undefined && right < 8) right = 8;
    if (top + popoverRect.height > window.innerHeight - 8) {
      top = rect.top - popoverRect.height - 8;
    }

    if (right !== undefined) {
      positionStyle = `top: ${top}px; right: ${right}px;`;
    } else {
      positionStyle = `top: ${top}px; left: ${left}px;`;
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (
      popoverRef &&
      !popoverRef.contains(event.target as Node) &&
      anchorElement &&
      !anchorElement.contains(event.target as Node)
    ) {
      onclickoutside?.();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onclickoutside?.();
    }
  }

  function handleFocusIn(event: FocusEvent) {
    if (
      popoverRef &&
      !popoverRef.contains(event.target as Node) &&
      anchorElement &&
      !anchorElement.contains(event.target as Node)
    ) {
      // Focus trap: return focus to popover
      const firstFocusable = popoverRef.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }
  }

  // Position update effect
  $effect(() => {
    if (open && anchorElement) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(updatePosition);
    }
  });

  // Event listeners setup and cleanup using $effect
  $effect(() => {
    if (!isBrowser) return;

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('focusin', handleFocusIn);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  });
</script>

{#if open}
  <div
    bind:this={popoverRef}
    class="ui-user-settings-popover"
    role="dialog"
    aria-modal="true"
    aria-label="User settings"
    style="
      position: fixed;
      z-index: 1500;
      background-color: var(--bg-2);
      border: 1px solid var(--ui);
      border-radius: var(--border-radius-lg);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      max-width: 360px;
      min-width: 280px;
      max-height: calc(100vh - 80px);
      overflow-y: auto;
      {positionStyle}
    "
  >
    {@render children()}
  </div>
{/if}
