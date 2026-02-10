<script lang="ts">
  import { marked } from 'marked';

  interface Props {
    /** The current text content (grows as chunks arrive) */
    content: string;
    /** Whether content is still streaming */
    streaming?: boolean;
    /** Show blinking cursor while streaming */
    cursor?: boolean;
    /** Called when streaming completes */
    onComplete?: () => void;
    class?: string;
  }

  let {
    content,
    streaming = false,
    cursor = true,
    onComplete,
    class: className = '',
  }: Props = $props();

  let prevStreaming = $state(false);

  // Configure marked for GFM
  marked.setOptions({
    gfm: true,
    breaks: true,
  });

  // Initialize prevStreaming to match the initial streaming prop
  $effect(() => {
    // On first run, just set the initial value; on subsequent runs, detect transitions
    if (prevStreaming && !streaming) {
      onComplete?.();
    }
    prevStreaming = streaming;
  });

  /**
   * Handle incomplete markdown gracefully
   * - Close unclosed code fences
   * - Handle partial formatting
   */
  function preprocessContent(text: string): string {
    if (!text) return '';

    let processed = text;

    // Count code fences to check if we have an unclosed one
    const fenceMatches = processed.match(/```/g);
    const fenceCount = fenceMatches ? fenceMatches.length : 0;

    if (fenceCount % 2 !== 0) {
      // We have an unclosed code fence - add a closing one
      // This prevents the rest of the content from being treated as code
      processed += '\n```';
    }

    // Handle unclosed inline code
    const backtickMatches = processed.match(/(?<!`)`(?!`)/g);
    const backtickCount = backtickMatches ? backtickMatches.length : 0;
    if (backtickCount % 2 !== 0) {
      processed += '`';
    }

    return processed;
  }

  function sanitizeHtml(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '');
  }

  const renderedHtml = $derived.by(() => {
    if (!content) return '';

    try {
      const processed = streaming ? preprocessContent(content) : content;
      let html = marked.parse(processed, { async: false }) as string;
      return sanitizeHtml(html);
    } catch (err) {
      console.error('Failed to parse markdown:', err);
      return `<pre style="white-space: pre-wrap;">${content}</pre>`;
    }
  });
</script>

<div class="ui-streaming-markdown {className}" class:streaming>
  <div class="markdown-content">
    {@html renderedHtml}
    {#if streaming && cursor}
      <span class="streaming-cursor"></span>
    {/if}
  </div>
</div>

<style>
  .ui-streaming-markdown {
    font-family: var(--font-body);
    font-size: var(--text-body-font-size);
    line-height: 1.6;
    color: var(--tx);
  }

  .streaming-cursor {
    display: inline-block;
    width: 2px;
    height: 1em;
    background: var(--primary);
    margin-left: 2px;
    vertical-align: text-bottom;
    animation: blink 1s step-end infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  /* Markdown content styles */
  .markdown-content :global(h1),
  .markdown-content :global(h2),
  .markdown-content :global(h3),
  .markdown-content :global(h4) {
    font-family: var(--font-heading);
    font-weight: 600;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    line-height: 1.3;
    color: var(--tx);
  }

  .markdown-content :global(h1:first-child),
  .markdown-content :global(h2:first-child),
  .markdown-content :global(h3:first-child) {
    margin-top: 0;
  }

  .markdown-content :global(h1) { font-size: 1.75rem; }
  .markdown-content :global(h2) { font-size: 1.5rem; }
  .markdown-content :global(h3) { font-size: 1.25rem; }
  .markdown-content :global(h4) { font-size: 1rem; }

  .markdown-content :global(p) {
    margin: 1em 0;
  }

  .markdown-content :global(p:first-child) {
    margin-top: 0;
  }

  .markdown-content :global(p:last-child) {
    margin-bottom: 0;
  }

  .markdown-content :global(a) {
    color: var(--primary);
    text-decoration: none;
  }

  .markdown-content :global(a:hover) {
    text-decoration: underline;
  }

  .markdown-content :global(strong) {
    font-weight: 600;
  }

  .markdown-content :global(code) {
    font-family: var(--font-mono);
    font-size: 0.875em;
    background: var(--bg-3);
    padding: 0.2em 0.4em;
    border-radius: var(--radius-sm);
  }

  .markdown-content :global(pre) {
    margin: 1em 0;
    padding: 1rem;
    background: var(--bg-3);
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    overflow-x: auto;
  }

  .markdown-content :global(pre code) {
    background: transparent;
    padding: 0;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .markdown-content :global(blockquote) {
    margin: 1em 0;
    padding: 0.5em 1em;
    border-left: 3px solid var(--primary);
    background: var(--bg-2);
    color: var(--tx-2);
  }

  .markdown-content :global(ul),
  .markdown-content :global(ol) {
    margin: 1em 0;
    padding-left: 2em;
  }

  .markdown-content :global(li) {
    margin: 0.25em 0;
  }

  .markdown-content :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 1em 0;
    font-size: 0.875rem;
  }

  .markdown-content :global(th),
  .markdown-content :global(td) {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--ui);
    text-align: left;
  }

  .markdown-content :global(th) {
    background: var(--bg-3);
    font-weight: 600;
  }
</style>
