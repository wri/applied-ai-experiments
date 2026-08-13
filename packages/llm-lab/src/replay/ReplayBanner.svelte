<script lang="ts">
  // Keyless-visitor affordance for playing a recorded session.
  //  - No provider key ready  → prominent "Play a recorded demo" banner.
  //  - A key is ready         → subtle "Demo replay" toggle (still available).
  //  - While replaying        → an "Exit to live" bar.
  // On play it activates the recording, restores the demo's inputs, then calls
  // the demo's own run handler — which now resolves every call from the fixture.
  import type { BYOKStores } from '@byo-keys/svelte';
  import type { ProviderId, LLMProvider, KeyStatus } from '@byo-keys/core';
  import { Button } from '@wri-datalab/ui';
  import {
    activateReplay,
    deactivateReplay,
    resetReplayCursor,
    isReplayActive,
    type ReplaySession,
  } from './replay.svelte';

  interface Props {
    stores: BYOKStores;
    session: ReplaySession;
    /** The demo's normal run handler, invoked after inputs are restored. */
    onPlay: () => void;
    /** Restore the demo's inputs from the recorded config blob. */
    restoreConfig?: (config: Record<string, unknown>) => void;
    title?: string;
    description?: string;
  }

  let { stores, session, onPlay, restoreConfig, title, description }: Props = $props();

  // Subscribe to key/provider state (house idiom — see ui/ModelSelector.svelte).
  let keys: Partial<Record<ProviderId, KeyStatus>> = $state({});
  let providers: LLMProvider[] = $state([]);

  $effect(() => {
    const unsubKeys = stores.keys.subscribe((value) => {
      keys = value;
    });
    const unsubProviders = stores.providers.subscribe((value) => {
      providers = value;
    });
    return () => {
      unsubKeys();
      unsubProviders();
    };
  });

  // "Can the visitor make a live call right now?" A key-required provider needs a
  // valid key; a keyless provider (e.g. Ollama) only counts if models were actually
  // discovered — registered-but-unreachable should still offer replay.
  const canRunLive = $derived(
    providers.some((p) => {
      const status = keys[p.config.id];
      if (p.config.requiresKey) return status?.hasKey === true && status?.isValid === true;
      return (status?.models?.length ?? 0) > 0;
    })
  );

  const hasSession = $derived(
    !!session && Array.isArray(session.calls) && session.calls.length > 0
  );
  const replaying = $derived(isReplayActive());

  const bannerTitle = $derived(title ?? session?.title ?? 'No API key? Watch a recorded session');
  const bannerDescription = $derived(
    description ??
      session?.description ??
      'Play back a real session that was recorded earlier — no API key required.'
  );

  function play() {
    if (isReplayActive()) resetReplayCursor();
    else activateReplay(session);
    restoreConfig?.(session.config);
    onPlay();
  }

  function exit() {
    deactivateReplay();
  }
</script>

{#if hasSession}
  {#if replaying}
    <div class="replay-bar replay-bar--active" role="status">
      <span class="replay-bar__dot" aria-hidden="true">▶</span>
      <span class="replay-bar__text">Replaying a recorded session</span>
      <div class="replay-bar__actions">
        <Button variant="ghost" size="sm" onclick={play}>Replay again</Button>
        <Button variant="secondary" size="sm" onclick={exit}>✕ Exit to live</Button>
      </div>
    </div>
  {:else if !canRunLive}
    <div class="replay-bar replay-bar--offer">
      <div class="replay-bar__copy">
        <span class="replay-bar__title">{bannerTitle}</span>
        <span class="replay-bar__desc">{bannerDescription}</span>
      </div>
      <Button variant="primary" size="sm" onclick={play}>▶ Play a recorded demo</Button>
    </div>
  {:else}
    <div class="replay-bar replay-bar--toggle">
      <Button variant="ghost" size="sm" onclick={play}>▶ Demo replay</Button>
    </div>
  {/if}
{/if}

<style>
  .replay-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border-radius: var(--radius, 8px);
    font-size: 0.85rem;
  }

  .replay-bar--offer {
    justify-content: space-between;
    flex-wrap: wrap;
    padding: 0.75rem 1rem;
    background-color: var(--surface-2, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--accent, #d97706);
  }

  .replay-bar--active {
    justify-content: space-between;
    flex-wrap: wrap;
    padding: 0.5rem 1rem;
    background-color: var(--surface-2, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--border, #333);
  }

  .replay-bar--toggle {
    justify-content: flex-end;
    padding: 0;
  }

  .replay-bar__copy {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .replay-bar__title {
    font-weight: 600;
    color: var(--text, inherit);
  }

  .replay-bar__desc {
    color: var(--text-secondary, #888);
  }

  .replay-bar__dot {
    color: var(--accent, #d97706);
  }

  .replay-bar__text {
    font-weight: 500;
  }

  .replay-bar__actions {
    display: flex;
    gap: 0.25rem;
    margin-left: auto;
  }
</style>
