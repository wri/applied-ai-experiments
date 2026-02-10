<script lang="ts">
  import { Button } from '@wri-datalab/ui';

  interface Props {
    value?: string;
    disabled?: boolean;
    placeholder?: string;
    onsubmit?: (value: string) => void;
    class?: string;
  }

  let {
    value = $bindable(''),
    disabled = false,
    placeholder = 'Ask about the map...',
    onsubmit,
    class: className = '',
  }: Props = $props();

  let textarea: HTMLTextAreaElement;

  function handleSubmit() {
    if (!value.trim() || disabled) return;
    onsubmit?.(value.trim());
    value = '';
    // Reset textarea height
    if (textarea) {
      textarea.style.height = 'auto';
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  function handleInput() {
    // Auto-resize textarea
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }
</script>

<div class="chat-input {className}">
  <textarea
    bind:this={textarea}
    bind:value
    {disabled}
    {placeholder}
    onkeydown={handleKeydown}
    oninput={handleInput}
    rows="1"
  ></textarea>
  <Button
    variant="primary"
    size="sm"
    {disabled}
    onclick={handleSubmit}
  >
    Send
  </Button>
</div>

<style>
  .chat-input {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--bg);
    border-top: 1px solid var(--ui);
  }

  textarea {
    flex: 1;
    resize: none;
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-body);
    font-size: var(--text-body-font-size);
    background: var(--bg);
    color: var(--tx);
    min-height: 40px;
    max-height: 150px;
    line-height: 1.5;
  }

  textarea:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px oklch(from var(--primary) l c h / 0.2);
  }

  textarea:disabled {
    background: var(--bg-2);
    cursor: not-allowed;
  }

  textarea::placeholder {
    color: var(--tx-3);
  }
</style>
