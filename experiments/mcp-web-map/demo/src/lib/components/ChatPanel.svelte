<script lang="ts">
  import { ChatMessage, Button } from '@wri-datalab/ui';
  import ChatInput from './ChatInput.svelte';
  import ToolCall from './ToolCall.svelte';
  import { chatStore, type ChatMessage as ChatMessageType } from '../stores/chat.svelte';

  interface Props {
    collapsed?: boolean;
    disabled?: boolean;
    onsubmit?: (message: string) => void;
    oncollapse?: () => void;
    class?: string;
  }

  let {
    collapsed = $bindable(false),
    disabled = false,
    onsubmit,
    oncollapse,
    class: className = '',
  }: Props = $props();

  let messagesContainer: HTMLDivElement = $state(null!);

  // Auto-scroll to bottom when messages change
  $effect(() => {
    // Access messages to create dependency
    const _ = chatStore.messages;
    if (messagesContainer) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      });
    }
  });

  function handleSubmit(value: string) {
    onsubmit?.(value);
  }

  function handleClear() {
    chatStore.clear();
  }

  function toggleCollapse() {
    collapsed = !collapsed;
    oncollapse?.();
  }
</script>

<aside class="chat-panel {className}" class:collapsed>
  <header class="panel-header">
    <button class="collapse-btn" onclick={toggleCollapse} title={collapsed ? 'Expand chat' : 'Collapse chat'}>
      <span class="collapse-icon" class:collapsed>{collapsed ? '«' : '»'}</span>
    </button>
    {#if !collapsed}
      <h2>Chat</h2>
      <div class="header-actions">
        {#if chatStore.messages.length > 0}
          <Button variant="ghost" size="sm" onclick={handleClear}>Clear</Button>
        {/if}
      </div>
    {/if}
  </header>

  {#if !collapsed}
    <div class="messages" bind:this={messagesContainer}>
      {#if chatStore.messages.length === 0}
        <div class="empty-state">
          <p>Ask me to control the map!</p>
          <p class="hint">Try: "Fly to Paris" or "Show the satellite layer"</p>
        </div>
      {:else}
        {#each chatStore.messages as message (message.id)}
          <div class="message-wrapper">
            <ChatMessage
              role={message.role}
              content={message.content}
              timestamp={message.timestamp}
              status={message.status}
              thinking={message.thinking}
            />
            {#if message.toolCalls && message.toolCalls.length > 0}
              <div class="tool-calls">
                {#each message.toolCalls as toolCall (toolCall.id)}
                  <ToolCall {toolCall} />
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>

    <ChatInput
      disabled={disabled || chatStore.isStreaming}
      onsubmit={handleSubmit}
    />
  {/if}
</aside>

<style>
  .chat-panel {
    display: flex;
    flex-direction: column;
    width: 380px;
    min-width: 380px;
    max-width: 380px;
    background: var(--bg);
    border-left: 1px solid var(--ui);
    transition: width 0.2s ease, min-width 0.2s ease;
  }

  .chat-panel.collapsed {
    width: 48px;
    min-width: 48px;
    max-width: 48px;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    border-bottom: 1px solid var(--ui);
    background: var(--bg-2);
  }

  .collapse-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--tx-2);
    font-size: 1rem;
    border-radius: var(--radius-sm);
  }

  .collapse-btn:hover {
    background: var(--bg-3);
    color: var(--tx);
  }

  .collapse-icon {
    transition: transform 0.2s ease;
  }

  h2 {
    flex: 1;
    font-size: 1rem;
    font-weight: 600;
    color: var(--tx);
    margin: 0;
  }

  .header-actions {
    display: flex;
    gap: var(--space-1);
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .message-wrapper {
    display: flex;
    flex-direction: column;
  }

  .tool-calls {
    margin-left: var(--space-4);
    margin-top: var(--space-1);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: var(--tx-2);
    padding: var(--space-6);
  }

  .empty-state p {
    margin: 0;
    font-size: 1rem;
  }

  .empty-state .hint {
    margin-top: var(--space-2);
    font-size: 0.875rem;
    color: var(--tx-3);
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .chat-panel {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      width: 100%;
      max-width: 100%;
      min-width: 100%;
      height: 50vh;
      border-left: none;
      border-top: 1px solid var(--ui);
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      z-index: 100;
    }

    .chat-panel.collapsed {
      width: 100%;
      min-width: 100%;
      max-width: 100%;
      height: auto;
    }

    .collapse-icon {
      transform: rotate(90deg);
    }

    .collapse-icon.collapsed {
      transform: rotate(-90deg);
    }
  }
</style>
