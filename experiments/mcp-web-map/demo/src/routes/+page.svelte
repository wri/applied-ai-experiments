<script lang="ts">
  import { DemoLayout } from '@wri-datalab/ui';
  import type { KeyStatus, ProviderId } from '@byo-keys/core';
  import MapView from '$lib/components/MapView.svelte';
  import ChatPanel from '$lib/components/ChatPanel.svelte';
  import CommandPalette from '$lib/components/CommandPalette.svelte';
  import LayerList from '$lib/components/LayerList.svelte';
  import { stores, initStores, storesReady, providerIds } from '$lib/stores';
  import { chatStore } from '$lib/stores/chat.svelte';
  import { mapStore } from '$lib/stores/map.svelte';
  import { mcpBridge } from '$lib/mcp/bridge';
  import { getToolsSystemPrompt } from '$lib/mcp/tools';

  // Track store initialization
  let isStoresReady = $state(false);
  let chatPanelCollapsed = $state(false);
  let commandPaletteOpen = $state(false);

  // BYOK key status
  let keys: Partial<Record<string, KeyStatus>> = $state({});

  // Initialize stores (using $effect since onMount doesn't fire reliably with DemoLayout)
  let storesInitialized = false;
  $effect(() => {
    if (!storesInitialized) {
      storesInitialized = true;
      initStores();
    }
  });

  // Track stores ready state
  $effect(() => {
    const unsubscribe = storesReady.subscribe((ready) => {
      isStoresReady = ready;
    });
    return unsubscribe;
  });

  // Track key status reactively
  $effect(() => {
    const unsubscribe = stores.keys.subscribe((value) => {
      keys = value;
    });
    return unsubscribe;
  });

  // Check if we have a ready provider
  const hasReadyProvider = $derived(
    providerIds.some((id) => {
      const status = keys[id];
      return status?.hasKey && status?.isValid !== false;
    })
  );

  // Get the first ready provider
  const readyProvider = $derived(
    providerIds.find((id) => {
      const status = keys[id];
      return status?.hasKey && status?.isValid !== false;
    }) as ProviderId | undefined
  );

  // Handle chat submission
  async function handleChatSubmit(message: string) {
    if (!readyProvider || chatStore.isStreaming) return;

    // Add user message
    chatStore.addUserMessage(message);

    // Add assistant message placeholder
    chatStore.addAssistantMessage();

    try {
      // Build messages with system prompt
      const systemPrompt = getToolsSystemPrompt() + `\n\nCurrent map state:\n- Center: [${mapStore.view.center[0].toFixed(4)}, ${mapStore.view.center[1].toFixed(4)}]\n- Zoom: ${mapStore.view.zoom.toFixed(2)}\n- Bearing: ${mapStore.view.bearing}°\n- Pitch: ${mapStore.view.pitch}°`;

      // Get chat history (excluding system messages - we pass system separately)
      const chatHistory = chatStore.getMessagesForAPI().filter(m => m.role !== 'system');

      const messages = [
        ...chatHistory,
        { role: 'user' as const, content: message },
      ];

      // Stream the response - pass system prompt as separate field for provider compatibility
      const stream = stores.chatStream(readyProvider, {
        model: getDefaultModel(readyProvider),
        messages,
        system: systemPrompt,  // Pass as separate field, not in messages array
        maxTokens: 2048,
        temperature: 0.7,
      });

      let fullContent = '';

      for await (const chunk of stream) {
        switch (chunk.type) {
          case 'delta':
            fullContent += chunk.content;
            chatStore.appendContent(chunk.content);
            break;

          case 'thinking_delta':
            // Could handle thinking display here
            break;

          case 'done':
            // Process tool calls from the response
            const toolCalls = mcpBridge.parseToolCalls(fullContent);

            if (toolCalls.length > 0) {
              // Execute each tool call
              for (const tc of toolCalls) {
                const toolCallEntry = chatStore.addToolCall({
                  id: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                  name: tc.name,
                  arguments: tc.arguments,
                });

                // Mark as running
                chatStore.updateToolCall(toolCallEntry.id, { status: 'running' });

                // Execute the tool
                const result = await mcpBridge.execute(tc.name, tc.arguments, toolCallEntry.id);

                // Update with result
                if (result.success) {
                  chatStore.updateToolCall(toolCallEntry.id, {
                    status: 'completed',
                    result: result.result,
                  });
                } else {
                  chatStore.updateToolCall(toolCallEntry.id, {
                    status: 'error',
                    error: result.error,
                  });
                }
              }

              // Clean the content to remove tool call blocks
              const cleanContent = mcpBridge.cleanContent(fullContent);
              chatStore.updateLastAssistant({ content: cleanContent, status: 'complete' });
            } else {
              chatStore.updateLastAssistant({ status: 'complete' });
            }
            break;

          case 'error':
            chatStore.updateLastAssistant({
              content: `Error: ${chunk.error.message}`,
              status: 'error',
            });
            break;
        }
      }
    } catch (error) {
      chatStore.updateLastAssistant({
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'error',
      });
    }
  }

  // Get default model for provider
  function getDefaultModel(provider: ProviderId): string {
    switch (provider) {
      case 'anthropic':
        return 'claude-haiku-4-5-20251001';
      case 'gemini':
        return 'gemini-3.0-flash';
      case 'openrouter':
        return 'anthropic/claude-4.5-haiku';
      default:
        return '';
    }
  }

  // Handle command palette command
  function handleCommand(command: string) {
    handleChatSubmit(command);
  }

  // Keyboard shortcut handler
  function handleKeydown(event: KeyboardEvent) {
    // Cmd/Ctrl + K for command palette
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      commandPaletteOpen = true;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<DemoLayout
  title="MCP Web Map"
  subtitle="AI-powered geospatial chat"
  {stores}
  providers={providerIds}
  showSettings={true}
  showApiKeys={true}
  showFooter={false}
  maxWidth="full"
>
  <div class="map-layout">
    <div class="map-area">
      <MapView />
      <LayerList />

      {#if mapStore.status === 'initializing'}
        <div class="map-overlay">
          <div class="spinner"></div>
          <p>Loading map...</p>
        </div>
      {/if}

      {#if mapStore.status === 'error'}
        <div class="map-overlay error">
          <h3>Map Error</h3>
          <p>{mapStore.error}</p>
          <button onclick={() => window.location.reload()}>Retry</button>
        </div>
      {/if}

      {#if !hasReadyProvider && mapStore.status === 'ready'}
        <div class="api-key-prompt">
          <div class="prompt-content">
            <h3>Get Started</h3>
            <p>Enter your API key in the header to start chatting with the map.</p>
            <p class="hint">Press <kbd>Cmd</kbd>+<kbd>K</kbd> to open the command palette</p>
          </div>
        </div>
      {/if}
    </div>

    <ChatPanel
      bind:collapsed={chatPanelCollapsed}
      disabled={!hasReadyProvider}
      onsubmit={handleChatSubmit}
    />
  </div>

  <CommandPalette
    bind:open={commandPaletteOpen}
    oncommand={handleCommand}
  />
</DemoLayout>

<style>
  .map-layout {
    display: flex;
    flex: 1;
    min-height: 0;
    height: calc(100vh - 60px); /* Subtract header height */
  }

  .map-area {
    flex: 1;
    position: relative;
    min-width: 0;
  }

  .map-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    z-index: 25;
    gap: var(--space-3);
    color: var(--tx);
  }

  .map-overlay p {
    margin: 0;
    color: white;
    font-size: 1rem;
  }

  .map-overlay.error {
    background: rgba(0, 0, 0, 0.7);
  }

  .map-overlay.error h3 {
    margin: 0;
    color: var(--error, #ef4444);
    font-size: 1.25rem;
  }

  .map-overlay.error p {
    color: var(--tx-2, #a0a0a0);
    max-width: 400px;
    text-align: center;
  }

  .map-overlay.error button {
    margin-top: var(--space-2);
    padding: var(--space-2) var(--space-4);
    background: var(--accent, #f59e0b);
    color: var(--bg, #1a1a1a);
    border: none;
    border-radius: var(--radius-md, 6px);
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .map-overlay.error button:hover {
    background: var(--accent-hover, #d97706);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: var(--accent, #f59e0b);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .api-key-prompt {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
    z-index: 20;
  }

  .prompt-content {
    background: var(--bg);
    padding: var(--space-6);
    border-radius: var(--radius-lg);
    text-align: center;
    max-width: 400px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
  }

  .prompt-content h3 {
    margin: 0 0 var(--space-3);
    color: var(--tx);
  }

  .prompt-content p {
    margin: 0 0 var(--space-2);
    color: var(--tx-2);
  }

  .prompt-content .hint {
    font-size: 0.875rem;
    color: var(--tx-3);
    margin-top: var(--space-4);
  }

  .prompt-content kbd {
    padding: 0.125rem 0.5rem;
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .map-layout {
      flex-direction: column;
      height: calc(100vh - 60px);
    }

    .map-area {
      flex: 1;
    }
  }
</style>
