<!-- ==========================================================================
  BYOK-LLM SvelteKit Integration Example
  
  This shows how to set up the complete key registration and chat flow
  in a SvelteKit application.
========================================================================== -->

<!-- ============================================
  src/lib/byok.ts - Client Configuration
============================================ -->
<!--
import { createBYOKClient } from '@byo-keys/core';
import { anthropic, openai, ollama } from '@byo-keys/providers';
import { createBYOKStores } from '@byo-keys/svelte';

// Create the client with your chosen providers
const client = createBYOKClient({
  providers: [
    anthropic({ 
      // Use a proxy in production for CORS
      proxyUrl: import.meta.env.DEV 
        ? undefined 
        : '/api/proxy/anthropic',
      // Or enable dangerous direct access for development
      dangerouslyAllowBrowser: import.meta.env.DEV,
    }),
    openai({
      proxyUrl: '/api/proxy/openai',
    }),
    ollama({
      baseUrl: 'http://localhost:11434',
    }),
  ],
  autoValidate: true,
});

// Export the stores
export const byok = createBYOKStores(client);
export const { keys, providers, chat, chatStream, initialize } = byok;
-->

<!-- ============================================
  src/routes/+layout.svelte - Root Layout
============================================ -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { byok } from '$lib/byok';
  import { setBYOKContext, initializeBYOK } from '@byo-keys/svelte';
  
  // Set context for child components
  setBYOKContext(byok);
  
  // Initialize on mount (browser only)
  onMount(() => initializeBYOK(byok));
</script>

<slot />


<!-- ============================================
  src/lib/components/KeyManager.svelte
  
  A complete key registration UI component
============================================ -->
<script lang="ts">
  import { getBYOKContext } from '@byo-keys/svelte';
  
  const { keys, providers, setKey, removeKey } = getBYOKContext();
  
  // Local state for the form
  let selectedProvider = '';
  let apiKey = '';
  let isSubmitting = false;
  let error: string | null = null;
  let success: string | null = null;
  
  // Get providers list
  $: providerList = $providers;
  
  // Get key status for selected provider
  $: selectedKeyStatus = selectedProvider ? $keys[selectedProvider] : null;
  
  async function handleSubmit() {
    if (!selectedProvider || !apiKey) return;
    
    isSubmitting = true;
    error = null;
    success = null;
    
    try {
      const result = await setKey(selectedProvider, apiKey);
      
      if (result.valid) {
        success = `API key validated! ${result.models?.length ?? 0} models available.`;
        apiKey = ''; // Clear the input
      } else {
        error = result.error ?? 'Invalid API key';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'An error occurred';
    } finally {
      isSubmitting = false;
    }
  }
  
  async function handleRemove(providerId: string) {
    if (confirm(`Remove API key for ${providerId}?`)) {
      await removeKey(providerId);
    }
  }
</script>

<div class="key-manager">
  <h2>API Key Management</h2>
  
  <!-- Current Keys Status -->
  <div class="keys-status">
    <h3>Configured Providers</h3>
    
    {#each providerList as provider (provider.config.id)}
      {@const status = $keys[provider.config.id]}
      <div class="provider-row">
        <span class="provider-name">{provider.config.name}</span>
        
        {#if !provider.config.requiresKey}
          <span class="status ready">No key required</span>
        {:else if status?.hasKey}
          {#if status.isValidating}
            <span class="status validating">Validating...</span>
          {:else if status.isValid}
            <span class="status valid">✓ Connected</span>
            <button 
              class="remove-btn" 
              on:click={() => handleRemove(provider.config.id)}
            >
              Remove
            </button>
          {:else}
            <span class="status invalid">✗ Invalid</span>
            <button 
              class="remove-btn" 
              on:click={() => handleRemove(provider.config.id)}
            >
              Remove
            </button>
          {/if}
        {:else}
          <span class="status missing">Not configured</span>
        {/if}
      </div>
    {/each}
  </div>
  
  <!-- Add New Key Form -->
  <form class="add-key-form" on:submit|preventDefault={handleSubmit}>
    <h3>Add API Key</h3>
    
    <div class="form-group">
      <label for="provider">Provider</label>
      <select id="provider" bind:value={selectedProvider}>
        <option value="">Select a provider...</option>
        {#each providerList.filter(p => p.config.requiresKey) as provider}
          <option value={provider.config.id}>
            {provider.config.name}
          </option>
        {/each}
      </select>
    </div>
    
    {#if selectedProvider}
      <div class="form-group">
        <label for="apiKey">API Key</label>
        <input
          id="apiKey"
          type="password"
          bind:value={apiKey}
          placeholder="sk-..."
          autocomplete="off"
        />
      </div>
      
      {#if error}
        <div class="message error">{error}</div>
      {/if}
      
      {#if success}
        <div class="message success">{success}</div>
      {/if}
      
      <button type="submit" disabled={isSubmitting || !apiKey}>
        {isSubmitting ? 'Validating...' : 'Save Key'}
      </button>
    {/if}
  </form>
  
  <!-- Security Notice -->
  <div class="security-notice">
    <h4>🔒 Security Note</h4>
    <p>
      Your API keys are stored locally in your browser and are never sent to 
      our servers. Keys are transmitted directly to the respective AI providers.
    </p>
  </div>
</div>

<style>
  .key-manager {
    max-width: 500px;
    margin: 0 auto;
    padding: 1.5rem;
  }
  
  .keys-status {
    margin-bottom: 2rem;
  }
  
  .provider-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    border-bottom: 1px solid #eee;
  }
  
  .provider-name {
    flex: 1;
    font-weight: 500;
  }
  
  .status {
    font-size: 0.875rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }
  
  .status.ready { background: #e8f5e9; color: #2e7d32; }
  .status.valid { background: #e8f5e9; color: #2e7d32; }
  .status.validating { background: #fff3e0; color: #ef6c00; }
  .status.invalid { background: #ffebee; color: #c62828; }
  .status.missing { background: #f5f5f5; color: #757575; }
  
  .remove-btn {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    background: #ffebee;
    color: #c62828;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .add-key-form {
    background: #f9f9f9;
    padding: 1.5rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }
  
  .form-group input,
  .form-group select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
  }
  
  button[type="submit"] {
    width: 100%;
    padding: 0.75rem;
    background: #1976d2;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
  }
  
  button[type="submit"]:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
  
  .message {
    padding: 0.75rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }
  
  .message.error { background: #ffebee; color: #c62828; }
  .message.success { background: #e8f5e9; color: #2e7d32; }
  
  .security-notice {
    background: #e3f2fd;
    padding: 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
  }
  
  .security-notice h4 {
    margin: 0 0 0.5rem 0;
  }
  
  .security-notice p {
    margin: 0;
    color: #1565c0;
  }
</style>


<!-- ============================================
  src/lib/components/Chat.svelte
  
  A streaming chat component
============================================ -->
<script lang="ts">
  import { getBYOKContext, createReadyProvidersStore } from '@byo-keys/svelte';
  import type { Message } from '@byo-keys/core';
  
  const stores = getBYOKContext();
  const { chat, createChatStream } = stores;
  
  // Only show providers that are ready to use
  const readyProviders = createReadyProvidersStore(stores);
  
  // Chat state
  let selectedProvider = '';
  let selectedModel = '';
  let userInput = '';
  let messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  
  // Streaming state
  let streamStore: ReturnType<typeof createChatStream> | null = null;
  $: isStreaming = streamStore ? $streamStore.streaming : false;
  $: streamContent = streamStore ? $streamStore.content : '';
  $: streamError = streamStore ? $streamStore.error : null;
  
  // Get models for selected provider
  $: selectedProviderObj = $readyProviders.find(p => p.config.id === selectedProvider);
  
  async function sendMessage() {
    if (!userInput.trim() || !selectedProvider || !selectedModel) return;
    
    const userMessage = userInput.trim();
    userInput = '';
    
    // Add user message
    messages = [...messages, { role: 'user', content: userMessage }];
    
    // Create stream store
    streamStore = createChatStream(selectedProvider, {
      model: selectedModel,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });
    
    // Start streaming
    await streamStore.start();
    
    // Add assistant message when done
    if ($streamStore.content && !$streamStore.error) {
      messages = [...messages, { role: 'assistant', content: $streamStore.content }];
    }
    
    streamStore = null;
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }
</script>

<div class="chat-container">
  <!-- Provider Selection -->
  <div class="chat-header">
    {#if $readyProviders.length === 0}
      <p class="warning">No providers configured. Add an API key to start chatting.</p>
    {:else}
      <select bind:value={selectedProvider}>
        <option value="">Select provider...</option>
        {#each $readyProviders as provider}
          <option value={provider.config.id}>{provider.config.name}</option>
        {/each}
      </select>
      
      {#if selectedProvider}
        <input 
          type="text" 
          bind:value={selectedModel} 
          placeholder="Model (e.g., claude-sonnet-4-20250514)"
        />
      {/if}
    {/if}
  </div>
  
  <!-- Messages -->
  <div class="messages">
    {#each messages as message}
      <div class="message {message.role}">
        <strong>{message.role === 'user' ? 'You' : 'Assistant'}:</strong>
        <p>{message.content}</p>
      </div>
    {/each}
    
    {#if isStreaming}
      <div class="message assistant streaming">
        <strong>Assistant:</strong>
        <p>{streamContent}<span class="cursor">▌</span></p>
      </div>
    {/if}
    
    {#if streamError}
      <div class="message error">
        <p>Error: {streamError.message}</p>
      </div>
    {/if}
  </div>
  
  <!-- Input -->
  <div class="chat-input">
    <textarea
      bind:value={userInput}
      on:keydown={handleKeydown}
      placeholder="Type a message..."
      disabled={isStreaming || !selectedProvider || !selectedModel}
    ></textarea>
    <button 
      on:click={sendMessage} 
      disabled={isStreaming || !userInput.trim() || !selectedProvider || !selectedModel}
    >
      {isStreaming ? 'Sending...' : 'Send'}
    </button>
  </div>
</div>

<style>
  .chat-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-width: 800px;
    margin: 0 auto;
  }
  
  .chat-header {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
    border-bottom: 1px solid #eee;
  }
  
  .chat-header select,
  .chat-header input {
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  .warning {
    color: #ef6c00;
  }
  
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }
  
  .message {
    margin-bottom: 1rem;
    padding: 0.75rem;
    border-radius: 8px;
  }
  
  .message.user {
    background: #e3f2fd;
  }
  
  .message.assistant {
    background: #f5f5f5;
  }
  
  .message.error {
    background: #ffebee;
    color: #c62828;
  }
  
  .message.streaming .cursor {
    animation: blink 1s infinite;
  }
  
  @keyframes blink {
    50% { opacity: 0; }
  }
  
  .chat-input {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
    border-top: 1px solid #eee;
  }
  
  .chat-input textarea {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    resize: none;
    min-height: 60px;
  }
  
  .chat-input button {
    padding: 0.75rem 1.5rem;
    background: #1976d2;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .chat-input button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
</style>
