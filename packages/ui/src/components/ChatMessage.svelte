<script lang="ts">
  import Markdown from './Markdown.svelte';
  import TokenCounter from './TokenCounter.svelte';
  import LatencyBadge from './LatencyBadge.svelte';
  import ThinkingSummary from './ThinkingSummary.svelte';
  import { formatTimestamp } from '../utils/formatters';

  interface Props {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: Date | string;
    model?: string;
    tokens?: { input?: number; output?: number };
    latency?: number;
    status?: 'streaming' | 'complete' | 'error';
    /** Thinking/reasoning content */
    thinking?: string;
    /** Whether thinking content is still streaming */
    thinkingStreaming?: boolean;
    /** Whether thinking panel is collapsed */
    thinkingCollapsed?: boolean;
    class?: string;
  }

  let {
    role,
    content,
    timestamp,
    model,
    tokens,
    latency,
    status = 'complete',
    thinking,
    thinkingStreaming = false,
    thinkingCollapsed = true,
    class: className = '',
  }: Props = $props();

  const isUser = $derived(role === 'user');
  const isSystem = $derived(role === 'system');
  const isAssistant = $derived(role === 'assistant');

  const roleStyles = $derived({
    user: {
      bg: 'oklch(from var(--primary) l c h / 0.1)',
      align: 'flex-end',
      borderColor: 'var(--primary)',
    },
    assistant: {
      bg: 'var(--bg-2)',
      align: 'flex-start',
      borderColor: 'var(--ui)',
    },
    system: {
      bg: 'var(--info-subtle)',
      align: 'center',
      borderColor: 'var(--info)',
    },
  }[role]);

  const roleLabel = $derived({
    user: 'You',
    assistant: model || 'Assistant',
    system: 'System',
  }[role]);

  const roleIcon = $derived({
    user: '\u{1F464}',
    assistant: '\u{1F916}',
    system: '\u2699',
  }[role]);
</script>

<div
  class="ui-chat-message {className}"
  style="
    display: flex;
    flex-direction: column;
    align-items: {roleStyles.align};
    max-width: {isSystem ? '100%' : '85%'};
    align-self: {roleStyles.align};
  "
>
  <!-- Header with role label -->
  <div style="
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
    font-family: var(--font-ui);
    font-size: 0.75rem;
    color: var(--tx-3);
  ">
    <span>{roleIcon}</span>
    <span>{roleLabel}</span>
    {#if timestamp}
      <span style="color: var(--tx-3);">·</span>
      <span>{formatTimestamp(timestamp)}</span>
    {/if}
  </div>

  <!-- Thinking/Reasoning Summary (for assistant messages) -->
  {#if isAssistant && (thinking || thinkingStreaming)}
    <div style="width: 100%; margin-bottom: 0.5rem;">
      <ThinkingSummary
        content={thinking ?? ''}
        streaming={thinkingStreaming}
        collapsed={thinkingCollapsed}
      />
    </div>
  {/if}

  <!-- Message bubble -->
  <div style="
    padding: 0.75rem 1rem;
    background: {roleStyles.bg};
    border: 1px solid {roleStyles.borderColor};
    border-radius: var(--radius-md);
    {isUser ? 'border-top-right-radius: var(--radius-sm);' : ''}
    {isAssistant ? 'border-top-left-radius: var(--radius-sm);' : ''}
    width: 100%;
    position: relative;
  ">
    {#if status === 'streaming'}
      <div style="
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        width: 8px;
        height: 8px;
        background: var(--primary);
        border-radius: 50%;
        animation: pulse 1.5s ease-in-out infinite;
      "></div>
    {/if}

    {#if status === 'error'}
      <div style="
        padding: 0.5rem;
        margin-bottom: 0.5rem;
        background: var(--error-subtle);
        border-radius: var(--radius-sm);
        color: var(--error-text);
        font-size: 0.875rem;
      ">
        Error generating response
      </div>
    {/if}

    {#if isUser}
      <p style="
        margin: 0;
        font-family: var(--font-body);
        font-size: var(--text-body-font-size);
        line-height: 1.5;
        color: var(--tx);
        white-space: pre-wrap;
      ">
        {content}
      </p>
    {:else if isSystem}
      <p style="
        margin: 0;
        font-family: var(--font-ui);
        font-size: 0.875rem;
        color: var(--info-text);
        text-align: center;
      ">
        {content}
      </p>
    {:else}
      <Markdown {content} />
    {/if}
  </div>

  <!-- Metadata footer -->
  {#if (tokens || latency) && isAssistant && status === 'complete'}
    <div style="
      display: flex;
      gap: 1rem;
      margin-top: 0.25rem;
      font-family: var(--font-ui);
      font-size: 0.75rem;
      color: var(--tx-3);
    ">
      {#if tokens}
        <TokenCounter {tokens} size="sm" showBreakdown />
      {/if}
      {#if latency}
        <LatencyBadge ms={latency} size="sm" />
      {/if}
    </div>
  {/if}
</div>

<style>
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.2); }
  }
</style>
