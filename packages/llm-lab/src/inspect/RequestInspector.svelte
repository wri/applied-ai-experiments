<script lang="ts">
  import {
    Tabs,
    JsonViewer,
    CodeBlock,
    Badge,
    TokenCounter,
    LatencyBadge,
    Modal,
  } from '@wri-datalab/ui';
  import type { InspectableRequest, RunResponse } from '../types';

  interface Props {
    request: InspectableRequest;
    responses?: RunResponse[];
    variant?: 'panel' | 'modal';
    /** Used by the modal variant */
    open?: boolean;
    title?: string;
  }

  let {
    request,
    responses = [],
    variant = 'panel',
    open = $bindable(false),
    title = 'Request inspector',
  }: Props = $props();

  let active = $state('messages');

  const tabs = $derived([
    { id: 'messages', label: 'Messages' },
    { id: 'params', label: 'Params' },
    ...(request.schema ? [{ id: 'schema', label: 'Schema' }] : []),
    ...(responses.length > 0 ? [{ id: 'response', label: 'Response' }] : []),
  ]);

  const paramEntries = $derived(
    Object.entries(request.params).filter(([, value]) => value !== undefined)
  );
</script>

{#snippet body()}
  <div class="llm-lab-inspector">
    <div class="llm-lab-inspector__meta">
      <Badge variant="info">{request.providerId}</Badge>
      <Badge>{request.model}</Badge>
      {#if request.label}
        <Badge variant="warning">{request.label}</Badge>
      {/if}
      <span class="llm-lab-inspector__time">
        {new Date(request.sentAt).toLocaleTimeString()}
      </span>
    </div>

    <Tabs items={tabs} bind:active size="sm" />

    {#if active === 'messages'}
      {#if request.system}
        <p class="llm-lab-inspector__label">System prompt</p>
        <CodeBlock code={request.system} language="markdown" maxHeight="16rem" />
      {/if}
      <p class="llm-lab-inspector__label">Messages</p>
      <JsonViewer data={request.messages} initialExpandDepth={3} maxStringLength={400} />
    {:else if active === 'params'}
      {#if paramEntries.length > 0}
        <dl class="llm-lab-inspector__params">
          {#each paramEntries as [key, value] (key)}
            <dt>{key}</dt>
            <dd>{value}</dd>
          {/each}
        </dl>
      {:else}
        <p class="llm-lab-inspector__empty">Provider defaults (no overrides)</p>
      {/if}
    {:else if active === 'schema' && request.schema}
      <CodeBlock code={JSON.stringify(request.schema, null, 2)} language="json" maxHeight="24rem" />
    {:else if active === 'response'}
      {#each responses as response, i (i)}
        <div class="llm-lab-inspector__response">
          {#if responses.length > 1}
            <p class="llm-lab-inspector__label">Response {i + 1}</p>
          {/if}
          <div class="llm-lab-inspector__meta">
            {#if response.error}
              <Badge variant="error">{response.error}</Badge>
            {/if}
            {#if response.latencyMs > 0}
              <LatencyBadge ms={response.latencyMs} size="sm" />
            {/if}
            {#if response.usage}
              <TokenCounter
                tokens={{ input: response.usage.inputTokens, output: response.usage.outputTokens }}
                showBreakdown
                size="sm"
              />
            {/if}
          </div>
          <CodeBlock code={response.content || '(empty)'} language="markdown" maxHeight="20rem" />
        </div>
      {/each}
    {/if}
  </div>
{/snippet}

{#if variant === 'modal'}
  <Modal bind:open {title} size="lg">
    {@render body()}
  </Modal>
{:else}
  {@render body()}
{/if}

<style>
  .llm-lab-inspector {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    font-family: var(--font-mono, monospace);
  }

  .llm-lab-inspector__meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .llm-lab-inspector__time {
    font-size: 0.75rem;
    color: var(--text-secondary, #888);
  }

  .llm-lab-inspector__label {
    margin: 0;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-secondary, #888);
  }

  .llm-lab-inspector__params {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.25rem 1rem;
    margin: 0;
    font-size: 0.8rem;
  }

  .llm-lab-inspector__params dt {
    color: var(--text-secondary, #888);
  }

  .llm-lab-inspector__params dd {
    margin: 0;
  }

  .llm-lab-inspector__empty {
    font-size: 0.8rem;
    color: var(--text-secondary, #888);
  }

  .llm-lab-inspector__response {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
</style>
