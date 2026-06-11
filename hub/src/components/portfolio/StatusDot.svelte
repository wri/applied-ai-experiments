<script lang="ts">
  import type { Status } from '../../lib/portfolio/types';

  interface Props {
    status: Status;
    interactive?: boolean;
    onclick?: () => void;
  }

  const { status, interactive = false, onclick }: Props = $props();

  const LABELS: Record<Status, string> = {
    idea: 'idea',
    started: 'active',
    paused: 'paused',
    completed: 'done',
    archived: 'archived'
  };
</script>

{#if interactive}
  <button
    type="button"
    class="dot dot-{status}"
    onclick={(e) => { e.stopPropagation(); onclick?.(); }}
    title={LABELS[status]}
    aria-label={`Status: ${LABELS[status]} — click to change`}
  >
    <span class="dot-inner"></span>
  </button>
{:else}
  <span class="dot dot-{status}" aria-label={`Status: ${LABELS[status]}`}>
    <span class="dot-inner"></span>
  </span>
{/if}

<style>
  .dot {
    display: inline-block;
    width: 0.625rem;
    height: 0.625rem;
    border-radius: var(--radius-full);
    padding: 0;
    border: 1px solid var(--ui-2);
    background: var(--bg-3);
    line-height: 0;
    cursor: default;
  }
  button.dot {
    cursor: pointer;
  }
  button.dot:hover {
    border-color: var(--primary);
  }
  .dot-inner {
    display: inline-block;
    width: 100%;
    height: 100%;
    border-radius: var(--radius-full);
  }
  .dot-idea .dot-inner      { background: transparent; }
  .dot-started .dot-inner   { background: var(--info, #38bdf8); }
  .dot-paused .dot-inner    { background: var(--warning, #fbbf24); }
  .dot-completed .dot-inner { background: var(--success, #4ade80); }
  .dot-archived .dot-inner  { background: var(--tx-3); }
</style>
