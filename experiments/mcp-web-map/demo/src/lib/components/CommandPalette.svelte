<script lang="ts">
  import { Button } from '@wri-datalab/ui';
  import { allToolDefinitions } from '../mcp/tools';

  interface Props {
    open?: boolean;
    onclose?: () => void;
    oncommand?: (command: string) => void;
    class?: string;
  }

  let {
    open = $bindable(false),
    onclose,
    oncommand,
    class: className = '',
  }: Props = $props();

  let searchQuery = $state('');
  let inputElement: HTMLInputElement = $state(null!);

  // Predefined quick commands
  const quickCommands = [
    { label: 'Fly to New York', command: 'Fly to New York City' },
    { label: 'Fly to London', command: 'Fly to London, UK' },
    { label: 'Fly to Tokyo', command: 'Fly to Tokyo, Japan' },
    { label: 'Show satellite', command: 'Show the satellite layer' },
    { label: 'Hide satellite', command: 'Hide the satellite layer' },
    { label: 'List layers', command: 'What layers are available?' },
    { label: 'Get current view', command: 'What is the current map view?' },
    { label: 'Copy share link', command: 'Copy a shareable link to this view' },
    { label: 'Zoom in', command: 'Zoom in to level 15' },
    { label: 'Reset view', command: 'Reset the map to the default view' },
  ];

  // Filter commands based on search
  const filteredCommands = $derived(
    searchQuery.trim()
      ? quickCommands.filter((cmd) =>
          cmd.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cmd.command.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : quickCommands
  );

  // Focus input when opened
  $effect(() => {
    if (open && inputElement) {
      requestAnimationFrame(() => {
        inputElement.focus();
      });
    }
  });

  function handleClose() {
    open = false;
    searchQuery = '';
    onclose?.();
  }

  function handleSelect(command: string) {
    oncommand?.(command);
    handleClose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    } else if (event.key === 'Enter' && searchQuery.trim()) {
      // Submit custom command
      handleSelect(searchQuery.trim());
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="command-palette-backdrop {className}" onclick={handleBackdropClick}>
    <div class="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="search-container">
        <input
          bind:this={inputElement}
          bind:value={searchQuery}
          type="text"
          placeholder="Type a command or search..."
          onkeydown={handleKeydown}
        />
        <kbd class="shortcut">ESC</kbd>
      </div>

      <div class="commands-list">
        {#if filteredCommands.length > 0}
          {#each filteredCommands as cmd}
            <button
              class="command-item"
              onclick={() => handleSelect(cmd.command)}
            >
              <span class="command-label">{cmd.label}</span>
              <span class="command-preview">{cmd.command}</span>
            </button>
          {/each}
        {:else if searchQuery.trim()}
          <button
            class="command-item custom"
            onclick={() => handleSelect(searchQuery.trim())}
          >
            <span class="command-label">Send to assistant</span>
            <span class="command-preview">"{searchQuery}"</span>
          </button>
        {:else}
          <div class="empty-state">No commands found</div>
        {/if}
      </div>

      <footer class="palette-footer">
        <span class="hint">Press <kbd>Enter</kbd> to send · <kbd>ESC</kbd> to close</span>
      </footer>
    </div>
  </div>
{/if}

<style>
  .command-palette-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 15vh;
    z-index: 1000;
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .command-palette {
    background: var(--bg);
    border: 1px solid var(--ui);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 560px;
    max-height: 60vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    animation: slideDown 0.15s ease;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .search-container {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4);
    border-bottom: 1px solid var(--ui);
  }

  input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 1.125rem;
    color: var(--tx);
    outline: none;
    font-family: var(--font-body);
  }

  input::placeholder {
    color: var(--tx-3);
  }

  .shortcut {
    padding: 0.25rem 0.5rem;
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--tx-3);
  }

  .commands-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-2);
  }

  .command-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: var(--space-3);
    border: none;
    background: transparent;
    cursor: pointer;
    text-align: left;
    border-radius: var(--radius-md);
    transition: background 0.1s ease;
  }

  .command-item:hover {
    background: var(--bg-2);
  }

  .command-item.custom {
    border: 1px dashed var(--ui);
    background: var(--bg-2);
  }

  .command-label {
    font-weight: 500;
    color: var(--tx);
  }

  .command-preview {
    font-size: 0.875rem;
    color: var(--tx-3);
    max-width: 50%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty-state {
    text-align: center;
    padding: var(--space-6);
    color: var(--tx-3);
  }

  .palette-footer {
    padding: var(--space-3);
    border-top: 1px solid var(--ui);
    text-align: center;
  }

  .hint {
    font-size: 0.75rem;
    color: var(--tx-3);
  }

  .hint kbd {
    padding: 0.125rem 0.375rem;
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 0.625rem;
  }

  /* Mobile */
  @media (max-width: 640px) {
    .command-palette-backdrop {
      padding-top: 10vh;
      padding-left: var(--space-4);
      padding-right: var(--space-4);
    }

    .command-preview {
      display: none;
    }
  }
</style>
