<script lang="ts">
  import type { ToolCall } from '../stores/chat.svelte';
  import { Spinner } from '@wri-datalab/ui';

  interface Props {
    toolCall: ToolCall;
    class?: string;
  }

  let { toolCall, class: className = '' }: Props = $props();

  const statusIcon = $derived({
    pending: '...',
    running: '',
    completed: 'check',
    error: 'x',
  }[toolCall.status]);

  const statusColor = $derived({
    pending: 'var(--tx-3)',
    running: 'var(--primary)',
    completed: 'var(--success)',
    error: 'var(--error)',
  }[toolCall.status]);
</script>

<div class="tool-call {className}" style="--status-color: {statusColor}">
  <div class="tool-header">
    <div class="tool-icon">
      {#if toolCall.status === 'running'}
        <Spinner size="sm" />
      {:else if toolCall.status === 'completed'}
        <span class="status-icon success">&#10003;</span>
      {:else if toolCall.status === 'error'}
        <span class="status-icon error">&#10007;</span>
      {:else}
        <span class="status-icon pending">&#8226;</span>
      {/if}
    </div>
    <span class="tool-name">{toolCall.name}</span>
  </div>

  {#if Object.keys(toolCall.arguments).length > 0}
    <div class="tool-args">
      {#each Object.entries(toolCall.arguments) as [key, value]}
        <span class="arg">
          <span class="arg-key">{key}:</span>
          <span class="arg-value">{JSON.stringify(value)}</span>
        </span>
      {/each}
    </div>
  {/if}

  {#if toolCall.result !== undefined}
    <div class="tool-result">
      {#if typeof toolCall.result === 'object' && toolCall.result !== null && 'message' in toolCall.result}
        {(toolCall.result as {message: string}).message}
      {:else}
        <code>{JSON.stringify(toolCall.result, null, 2)}</code>
      {/if}
    </div>
  {/if}

  {#if toolCall.error}
    <div class="tool-error">
      {toolCall.error}
    </div>
  {/if}
</div>

<style>
  .tool-call {
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-3);
    font-size: 0.875rem;
    margin: var(--space-2) 0;
  }

  .tool-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .tool-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
  }

  .status-icon {
    font-size: 0.875rem;
    font-weight: bold;
  }

  .status-icon.success {
    color: var(--success);
  }

  .status-icon.error {
    color: var(--error);
  }

  .status-icon.pending {
    color: var(--tx-3);
  }

  .tool-name {
    font-family: var(--font-mono);
    font-weight: 500;
    color: var(--tx-2);
  }

  .tool-args {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-2);
    padding-left: 1.75rem;
  }

  .arg {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--tx-3);
  }

  .arg-key {
    color: var(--tx-2);
  }

  .arg-value {
    color: var(--primary);
  }

  .tool-result {
    margin-top: var(--space-2);
    padding: var(--space-2);
    padding-left: 1.75rem;
    font-size: 0.8125rem;
    color: var(--tx-2);
  }

  .tool-result code {
    display: block;
    font-size: 0.75rem;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .tool-error {
    margin-top: var(--space-2);
    padding-left: 1.75rem;
    color: var(--error);
    font-size: 0.8125rem;
  }
</style>
