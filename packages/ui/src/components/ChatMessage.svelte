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
    thinking?: string;
    thinkingStreaming?: boolean;
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
  class="ui-chat-message role-{role} {className}"
>
  <!-- Header with role label -->
  <div class="message-header">
    <span>{roleIcon}</span>
    <span>{roleLabel}</span>
    {#if timestamp}
      <span class="header-separator">&middot;</span>
      <span>{formatTimestamp(timestamp)}</span>
    {/if}
  </div>

  <!-- Thinking/Reasoning Summary (for assistant messages) -->
  {#if isAssistant && (thinking || thinkingStreaming)}
    <div class="thinking-wrapper">
      <ThinkingSummary
        content={thinking ?? ''}
        streaming={thinkingStreaming}
        collapsed={thinkingCollapsed}
      />
    </div>
  {/if}

  <!-- Message bubble -->
  <div class="message-bubble role-{role}">
    {#if status === 'streaming'}
      <div class="streaming-dot"></div>
    {/if}

    {#if status === 'error'}
      <div class="error-banner">
        Error generating response
      </div>
    {/if}

    {#if isUser}
      <p class="user-content">{content}</p>
    {:else if isSystem}
      <p class="system-content">{content}</p>
    {:else}
      <Markdown {content} />
    {/if}
  </div>

  <!-- Metadata footer -->
  {#if (tokens || latency) && isAssistant && status === 'complete'}
    <div class="message-meta">
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
  .ui-chat-message {
    display: flex;
    flex-direction: column;
    max-width: 85%;
  }

  .ui-chat-message.role-user {
    align-items: flex-end;
    align-self: flex-end;
  }

  .ui-chat-message.role-assistant {
    align-items: flex-start;
    align-self: flex-start;
  }

  .ui-chat-message.role-system {
    align-items: center;
    align-self: center;
    max-width: 100%;
  }

  .message-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
    font-family: var(--font-ui);
    font-size: 0.75rem;
    color: var(--tx-3);
  }

  .header-separator {
    color: var(--tx-3);
  }

  .thinking-wrapper {
    width: 100%;
    margin-bottom: 0.5rem;
  }

  .message-bubble {
    padding: 0.75rem 1rem;
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    width: 100%;
    position: relative;
  }

  .message-bubble.role-user {
    background: oklch(from var(--primary) l c h / 0.1);
    border-color: var(--primary);
    border-top-right-radius: var(--radius-sm);
  }

  .message-bubble.role-assistant {
    background: var(--bg-2);
    border-color: var(--ui);
    border-top-left-radius: var(--radius-sm);
  }

  .message-bubble.role-system {
    background: var(--info-subtle);
    border-color: var(--info);
  }

  .streaming-dot {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 8px;
    height: 8px;
    background: var(--primary);
    border-radius: 50%;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .error-banner {
    padding: 0.5rem;
    margin-bottom: 0.5rem;
    background: var(--error-subtle);
    border-radius: var(--radius-sm);
    color: var(--error-text);
    font-size: 0.875rem;
  }

  .user-content {
    margin: 0;
    font-family: var(--font-body);
    font-size: var(--text-body-font-size);
    line-height: 1.5;
    color: var(--tx);
    white-space: pre-wrap;
  }

  .system-content {
    margin: 0;
    font-family: var(--font-ui);
    font-size: 0.875rem;
    color: var(--info-text);
    text-align: center;
  }

  .message-meta {
    display: flex;
    gap: 1rem;
    margin-top: 0.25rem;
    font-family: var(--font-ui);
    font-size: 0.75rem;
    color: var(--tx-3);
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.2); }
  }
</style>
