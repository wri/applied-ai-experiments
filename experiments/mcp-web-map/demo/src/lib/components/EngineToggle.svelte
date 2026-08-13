<script lang="ts">
  import { engineStore } from '$lib/stores/engine.svelte';
  import { bridgeEngine, webmcpEngine, type EngineId } from '$lib/mcp/engine';

  const options: Array<{ id: EngineId; label: string; title: string }> = [
    { id: 'bridge', label: 'Custom bridge', title: bridgeEngine.description },
    { id: 'webmcp', label: 'WebMCP', title: webmcpEngine.description },
  ];

  let switching = $state(false);

  async function select(id: EngineId) {
    if (id === engineStore.current || switching) return;
    switching = true;
    try {
      await engineStore.setEngine(id);
    } finally {
      switching = false;
    }
  }

  // Status dot for the WebMCP option
  const webmcpStatus = $derived(
    engineStore.webmcpError ? 'error' : engineStore.webmcpReady ? 'ok' : 'idle'
  );
  const webmcpTitle = $derived(
    engineStore.webmcpError
      ? `WebMCP error: ${engineStore.webmcpError}`
      : engineStore.webmcpReady
        ? 'Tools registered via navigator.modelContext'
        : webmcpEngine.description
  );
</script>

<div class="engine-toggle" role="group" aria-label="Tool engine">
  <span class="caption">Engine</span>
  <div class="segmented">
    {#each options as opt}
      <button
        type="button"
        class="seg"
        class:active={engineStore.current === opt.id}
        title={opt.id === 'webmcp' ? webmcpTitle : opt.title}
        aria-pressed={engineStore.current === opt.id}
        disabled={switching}
        onclick={() => select(opt.id)}
      >
        {#if opt.id === 'webmcp'}
          <span class="dot" class:ok={webmcpStatus === 'ok'} class:error={webmcpStatus === 'error'}></span>
        {/if}
        {opt.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .engine-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .caption {
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tx-3);
    font-family: var(--font-mono);
  }

  .segmented {
    display: inline-flex;
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--bg-2);
  }

  .seg {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.3125rem 0.625rem;
    border: none;
    background: transparent;
    color: var(--tx-2);
    font-size: 0.8125rem;
    font-family: var(--font-mono);
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease;
    white-space: nowrap;
  }

  .seg + .seg {
    border-left: 1px solid var(--ui);
  }

  .seg:hover:not(:disabled) {
    background: var(--bg-3);
    color: var(--tx);
  }

  .seg.active {
    background: var(--accent, #f59e0b);
    color: var(--bg, #1a1a1a);
    font-weight: 600;
  }

  .seg:disabled {
    cursor: progress;
    opacity: 0.7;
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--tx-3);
    flex-shrink: 0;
  }

  .dot.ok {
    background: var(--success, #22c55e);
  }

  .dot.error {
    background: var(--error, #ef4444);
  }
</style>
