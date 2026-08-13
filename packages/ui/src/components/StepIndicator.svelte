<script lang="ts">
  interface Props {
    steps: string[];
    current: number;
    class?: string;
  }

  let {
    steps,
    current,
    class: className = '',
  }: Props = $props();
</script>

<div
  class="ui-step-indicator {className}"
  role="list"
  aria-label="Progress steps"
>
  {#each steps as step, index}
    {@const isComplete = index < current}
    {@const isCurrent = index === current}

    <div
      class="step"
      class:complete={isComplete}
      class:current={isCurrent}
      role="listitem"
      aria-current={isCurrent ? 'step' : undefined}
    >
      <div class="step-circle" class:complete={isComplete} class:current={isCurrent}>
        {#if isComplete}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        {:else}
          {index + 1}
        {/if}
      </div>

      <span class="step-label" class:current={isCurrent}>
        {step}
      </span>
    </div>

    {#if index < steps.length - 1}
      <div class="step-connector" class:complete={isComplete}></div>
    {/if}
  {/each}
</div>

<style>
  .ui-step-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .step {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .step-circle {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-mono);
    font-size: var(--text-ui);
    font-weight: 500;
    transition: all var(--transition-fast, 0.15s);
    background-color: transparent;
    color: var(--tx-3);
    border: 1px solid var(--ui);
  }

  .step-circle.complete {
    background-color: var(--primary);
    color: var(--primary-content);
    border-color: var(--primary);
  }

  .step-circle.current {
    color: var(--primary);
    border: 2px solid var(--primary);
  }

  .step-label {
    font-family: var(--font-mono);
    font-size: var(--text-ui);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    color: var(--tx-3);
  }

  .step-label.current {
    color: var(--tx);
  }

  .step-connector {
    width: var(--space-4);
    height: 1px;
    background-color: var(--ui);
  }

  .step-connector.complete {
    background-color: var(--primary);
  }
</style>
