<script lang="ts">
  interface Props {
    /** Thinking/reasoning content */
    content: string;
    /** Whether still receiving streaming content */
    streaming?: boolean;
    /** Whether panel is collapsed (bindable) */
    collapsed?: boolean;
    /** Show character count badge */
    showCharCount?: boolean;
    /** Header label */
    label?: string;
    /** Additional CSS classes */
    class?: string;
  }

  let {
    content,
    streaming = false,
    collapsed = $bindable(true),
    showCharCount = true,
    label = 'Reasoning',
    class: className = '',
  }: Props = $props();

  const previewLength = 100;
  const preview = $derived(
    content.length > previewLength
      ? content.slice(0, previewLength).trim() + '...'
      : content
  );

  function toggle() {
    collapsed = !collapsed;
  }

  function formatCharCount(count: number): string {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return String(count);
  }
</script>

<div
  class="ui-thinking-summary {className}"
  style="
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    background: var(--bg-2);
    overflow: hidden;
    font-family: var(--font-ui);
  "
>
  <!-- Header -->
  <button
    type="button"
    onclick={toggle}
    style="
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.5rem 0.75rem;
      background: none;
      border: none;
      cursor: pointer;
      text-align: left;
      color: var(--tx-2);
      font-family: var(--font-ui);
      font-size: 0.75rem;
      font-weight: 500;
    "
  >
    <!-- Chevron -->
    <span
      style="
        display: inline-flex;
        transition: transform 0.2s ease;
        transform: rotate({collapsed ? '0deg' : '90deg'});
        color: var(--tx-3);
      "
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M4 2L8 6L4 10"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>

    <!-- Label with streaming indicator -->
    <span style="display: flex; align-items: center; gap: 0.5rem;">
      {label}
      {#if streaming}
        <span
          style="
            width: 6px;
            height: 6px;
            background: var(--primary);
            border-radius: 50%;
            animation: thinking-pulse 1.5s ease-in-out infinite;
          "
        ></span>
      {/if}
    </span>

    <!-- Character count badge -->
    {#if showCharCount && content.length > 0}
      <span
        style="
          margin-left: auto;
          padding: 0.125rem 0.375rem;
          background: var(--bg-3);
          border-radius: var(--radius-sm);
          font-size: 0.625rem;
          color: var(--tx-3);
          font-family: var(--font-mono);
        "
      >
        {formatCharCount(content.length)} chars
      </span>
    {/if}
  </button>

  <!-- Content -->
  {#if collapsed}
    <!-- Preview when collapsed -->
    {#if content.length > 0}
      <div
        style="
          padding: 0 0.75rem 0.5rem 1.75rem;
          font-size: 0.75rem;
          color: var(--tx-3);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-style: italic;
        "
      >
        {preview}
      </div>
    {/if}
  {:else}
    <!-- Full content when expanded -->
    <div
      style="
        max-height: 400px;
        overflow-y: auto;
        padding: 0 0.75rem 0.75rem 0.75rem;
        border-top: 1px solid var(--ui);
      "
    >
      <pre
        style="
          margin: 0;
          padding: 0.5rem;
          background: var(--bg);
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-size: 0.75rem;
          line-height: 1.5;
          color: var(--tx-2);
          white-space: pre-wrap;
          word-break: break-word;
        "
      >{content}{#if streaming}<span class="thinking-cursor">|</span>{/if}</pre>
    </div>
  {/if}
</div>

<style>
  @keyframes thinking-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(1.2); }
  }

  .thinking-cursor {
    animation: cursor-blink 1s step-end infinite;
  }

  @keyframes cursor-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
</style>
