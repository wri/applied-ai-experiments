<script lang="ts">
  import { marked } from 'marked';

  interface Props {
    content: string;
    sanitize?: boolean;
    /** Constrain line length to a comfortable reading measure (~68ch). Off by
        default so in-panel / narrow usages are unaffected. */
    measure?: boolean;
    class?: string;
  }

  let {
    content,
    sanitize = true,
    measure = false,
    class: className = '',
  }: Props = $props();

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function sanitizeHtml(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '');
  }

  // Configure marked
  marked.setOptions({
    gfm: true,
    breaks: true,
  });

  const renderedHtml = $derived.by(() => {
    if (!content) return '';

    try {
      let html = marked.parse(content, { async: false }) as string;

      if (sanitize) {
        html = sanitizeHtml(html);
      }

      return html;
    } catch (err) {
      console.error('Failed to parse markdown:', err);
      return `<pre style="white-space: pre-wrap;">${escapeHtml(content)}</pre>`;
    }
  });
</script>

<div class="ui-markdown {className}">
  {#if renderedHtml}
    <div class="markdown-content" class:measure>
      {@html renderedHtml}
    </div>
  {/if}
</div>

<style>
  .markdown-content {
    font-family: var(--font-body);
    font-size: var(--text-prose-size);
    line-height: var(--text-prose-line-height);
    color: var(--tx);
  }

  .markdown-content.measure {
    max-width: var(--text-prose-measure);
  }

  .markdown-content :global(h1),
  .markdown-content :global(h2),
  .markdown-content :global(h3),
  .markdown-content :global(h4),
  .markdown-content :global(h5),
  .markdown-content :global(h6) {
    font-family: var(--font-heading);
    font-weight: 600;
    margin-top: 1.6em;
    margin-bottom: 0.5em;
    line-height: 1.3;
    color: var(--tx);
  }

  .markdown-content :global(h1:first-child),
  .markdown-content :global(h2:first-child),
  .markdown-content :global(h3:first-child) {
    margin-top: 0;
  }

  .markdown-content :global(h1) {
    font-size: var(--text-prose-h1);
    border-bottom: 1px solid var(--ui);
    padding-bottom: 0.3em;
  }

  .markdown-content :global(h2) {
    font-size: var(--text-prose-h2);
    border-bottom: 1px solid var(--ui);
    padding-bottom: 0.3em;
  }

  .markdown-content :global(h3) {
    font-size: var(--text-prose-h3);
  }

  .markdown-content :global(h4) {
    font-size: var(--text-prose-h4);
  }

  .markdown-content :global(p) {
    margin: var(--text-prose-gap) 0;
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
    color: var(--tx);
  }

  .markdown-content :global(em) {
    font-style: italic;
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

  .markdown-content :global(blockquote p) {
    margin: 0.5em 0;
  }

  .markdown-content :global(ul),
  .markdown-content :global(ol) {
    margin: var(--text-prose-gap) 0;
    padding-left: 1.6em;
  }

  .markdown-content :global(li) {
    margin: 0.4em 0;
  }

  .markdown-content :global(ul ul),
  .markdown-content :global(ol ol),
  .markdown-content :global(ul ol),
  .markdown-content :global(ol ul) {
    margin: 0.25em 0;
  }

  .markdown-content :global(hr) {
    border: none;
    border-top: 1px solid var(--ui);
    margin: 2em 0;
  }

  .markdown-content :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 1em 0;
    font-family: var(--font-ui);
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

  .markdown-content :global(tr:nth-child(even)) {
    background: var(--bg-2);
  }

  .markdown-content :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: var(--radius-md);
  }
</style>
