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
  style="
    display: flex;
    align-items: center;
    gap: var(--space-2);
  "
  role="list"
  aria-label="Progress steps"
>
  {#each steps as step, index}
    {@const isComplete = index < current}
    {@const isCurrent = index === current}
    {@const isPending = index > current}

    <div
      class="step"
      class:complete={isComplete}
      class:current={isCurrent}
      class:pending={isPending}
      style="
        display: flex;
        align-items: center;
        gap: var(--space-2);
      "
      role="listitem"
      aria-current={isCurrent ? 'step' : undefined}
    >
      <div
        class="step-indicator"
        style="
          width: 1.5rem;
          height: 1.5rem;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-mono);
          font-size: var(--text-ui);
          font-weight: 500;
          transition: all var(--transition-fast);
          {isComplete ? `
            background-color: var(--primary);
            color: var(--primary-content);
            border: 1px solid var(--primary);
          ` : isCurrent ? `
            background-color: transparent;
            color: var(--primary);
            border: 2px solid var(--primary);
          ` : `
            background-color: transparent;
            color: var(--tx-3);
            border: 1px solid var(--ui);
          `}
        "
      >
        {#if isComplete}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        {:else}
          {index + 1}
        {/if}
      </div>

      <span
        class="step-label"
        style="
          font-family: var(--font-mono);
          font-size: var(--text-ui);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.025em;
          {isCurrent ? `color: var(--tx);` : `color: var(--tx-3);`}
        "
      >
        {step}
      </span>
    </div>

    {#if index < steps.length - 1}
      <div
        class="step-connector"
        style="
          width: var(--space-4);
          height: 1px;
          {isComplete ? `background-color: var(--primary);` : `background-color: var(--ui);`}
        "
      ></div>
    {/if}
  {/each}
</div>
