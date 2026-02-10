<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';

  interface Props {
    open?: boolean;
    title?: string;
    size?: 'sm' | 'md' | 'lg' | 'full';
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
    showCloseButton?: boolean;
    children: Snippet;
    footer?: Snippet;
    onclose?: () => void;
    class?: string;
  }

  let {
    open = $bindable(false),
    title,
    size = 'md',
    closeOnBackdrop = true,
    closeOnEscape = true,
    showCloseButton = true,
    children,
    footer,
    onclose,
    class: className = '',
  }: Props = $props();

  let dialogRef: HTMLDialogElement | undefined;
  let previousActiveElement: HTMLElement | null = null;

  const sizeWidths = {
    sm: '400px',
    md: '560px',
    lg: '720px',
    full: '90vw',
  };

  function handleClose() {
    open = false;
    onclose?.();
  }

  function handleBackdropClick(e: MouseEvent) {
    // Only close if clicking the dialog backdrop (not the inner content)
    if (closeOnBackdrop && e.target === dialogRef) {
      handleClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (closeOnEscape && e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  }

  // Cleanup on unmount
  onMount(() => {
    return () => {
      document.body.style.overflow = '';
    };
  });

  // Sync open state with dialog - runs after DOM updates
  $effect(() => {
    // Read open first to ensure it's tracked as dependency
    const shouldOpen = open;

    // Skip if no dialog ref (SSR or not yet mounted)
    if (!dialogRef) return;

    if (shouldOpen) {
      if (!dialogRef.open) {
        previousActiveElement = document.activeElement as HTMLElement;
        dialogRef.showModal();
        document.body.style.overflow = 'hidden';
      }
    } else {
      if (dialogRef.open) {
        dialogRef.close();
        document.body.style.overflow = '';
        previousActiveElement?.focus();
      }
    }
  });
</script>

<dialog
  bind:this={dialogRef}
  class="ui-modal {className}"
  onclick={handleBackdropClick}
  onkeydown={handleKeydown}
>
  <!-- Inner wrapper handles flex layout so we don't override dialog's native display -->
  <div
    class="modal-container"
    style="
      max-width: {sizeWidths[size]};
      width: calc(100vw - 2rem);
      max-height: calc(100vh - 4rem);
    "
  >
    {#if title || showCloseButton}
      <header class="modal-header">
        {#if title}
          <h2 class="modal-title">{title}</h2>
        {:else}
          <span></span>
        {/if}
        {#if showCloseButton}
          <button
            type="button"
            class="modal-close-btn"
            onclick={handleClose}
            aria-label="Close"
          >
            &times;
          </button>
        {/if}
      </header>
    {/if}

    <div class="modal-body">
      {@render children()}
    </div>

    {#if footer}
      <footer class="modal-footer">
        {@render footer()}
      </footer>
    {/if}
  </div>
</dialog>

<style>
  /* Dialog base - let browser handle display */
  dialog.ui-modal {
    padding: 0;
    border: none;
    background: transparent;
    overflow: visible;
  }

  dialog.ui-modal::backdrop {
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }

  dialog.ui-modal[open] {
    animation: modalIn 0.2s ease-out;
  }

  /* Inner container handles layout and styling */
  .modal-container {
    display: flex;
    flex-direction: column;
    background: var(--bg-2);
    border-radius: var(--radius-lg);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    background: var(--bg-3);
    border-bottom: 1px solid var(--ui);
    flex-shrink: 0;
  }

  .modal-title {
    margin: 0;
    font-family: var(--font-ui);
    font-size: 1rem;
    font-weight: 600;
    color: var(--tx);
  }

  .modal-close-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--tx-2);
    font-size: 1.5rem;
    line-height: 1;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    transition: background-color var(--transition-fast, 0.15s) ease;
  }

  .modal-close-btn:hover {
    background-color: var(--bg-2);
  }

  .modal-body {
    padding: 1.25rem;
    overflow-y: auto;
    flex: 1;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    background: var(--bg);
    border-top: 1px solid var(--ui);
    flex-shrink: 0;
  }

  @keyframes modalIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
