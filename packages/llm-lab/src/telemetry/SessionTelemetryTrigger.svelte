<script lang="ts">
  import { HeaderButton } from '@wri-datalab/ui';
  import { sessionTelemetry } from './session-telemetry.svelte';
  import { telemetryPanel } from './telemetry-ui.svelte';

  interface Props {
    class?: string;
  }

  let { class: className = '' }: Props = $props();

  const agg = $derived(sessionTelemetry.aggregates);
</script>

<!-- Header companion to SessionTelemetry (mount that with trigger="none").
     Always visible so the header never reflows; the count chip appears once
     the session has calls. -->
<span class="tel-trigger {className}">
  <HeaderButton
    variant="icon"
    label="Session telemetry"
    active={telemetryPanel.open}
    onclick={() => telemetryPanel.toggle()}
  >
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </svg>
  </HeaderButton>
  {#if agg.totalCalls > 0}
    <span class="tel-trigger__count" class:tel-trigger__count--error={agg.errorCount > 0}>
      {agg.totalCalls}
    </span>
  {/if}
</span>

<style>
  .tel-trigger {
    position: relative;
    display: inline-flex;
  }

  .tel-trigger__count {
    position: absolute;
    top: -0.375rem;
    right: -0.375rem;
    min-width: 0.875rem;
    height: 0.875rem;
    padding: 0 0.2rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-full, 9999px);
    background: var(--primary);
    color: var(--primary-content);
    font-family: var(--font-mono);
    font-size: 0.575rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    pointer-events: none;
  }

  .tel-trigger__count--error {
    background: var(--error);
    color: #fff;
  }
</style>
