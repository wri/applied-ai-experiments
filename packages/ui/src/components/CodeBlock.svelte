<script lang="ts">
  import CopyButton from './CopyButton.svelte';
  import { getHighlighter } from '../utils/highlighter';


  interface Props {
    code: string;
    language?: string;
    showLineNumbers?: boolean;
    highlightLines?: number[];
    maxHeight?: string;
    copyable?: boolean;
    filename?: string;
    class?: string;
  }

  let {
    code,
    language = 'plaintext',
    showLineNumbers = false,
    highlightLines = [],
    maxHeight,
    copyable = true,
    filename,
    class: className = '',
  }: Props = $props();

  let highlightedHtml = $state<string | null>(null);
  let theme = $state<'dark' | 'light'>('dark');
  let observer: MutationObserver | null = null;

  const normalizedCode = $derived(code.endsWith('\n') ? code.slice(0, -1) : code);
  const lines = $derived(normalizedCode.split('\n'));
  const highlightSet = $derived(new Set(highlightLines));

  function detectTheme(): 'dark' | 'light' {
    if (typeof window === 'undefined') return 'dark';

    // First check data-theme attribute
    const root = document.documentElement;
    const dataTheme = root.getAttribute('data-theme') ||
                      document.body.getAttribute('data-theme') ||
                      document.querySelector('[data-variant]')?.getAttribute('data-theme');

    if (dataTheme === 'light') return 'light';
    if (dataTheme === 'dark' || dataTheme === 'high-contrast') return 'dark';

    // Fallback: check background lightness
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    if (bg.includes('oklch')) {
      const match = bg.match(/oklch\(\s*([\d.]+)/);
      if (match) {
        const lightness = parseFloat(match[1]);
        return lightness > 0.5 ? 'light' : 'dark';
      }
    }
    return 'dark';
  }

  function setupThemeObserver() {
    if (typeof window === 'undefined' || observer) return;

    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          const newTheme = detectTheme();
          if (newTheme !== theme) {
            theme = newTheme;
          }
        }
      }
    });

    // Observe the document element and body for theme changes
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

    // Also observe any element with data-variant
    const variantEl = document.querySelector('[data-variant]');
    if (variantEl && variantEl !== document.documentElement && variantEl !== document.body) {
      observer.observe(variantEl, { attributes: true, attributeFilter: ['data-theme'] });
    }
  }

  async function highlight() {
    try {
      const highlighter = await getHighlighter();
      const themeName = theme === 'dark' ? 'github-dark' : 'github-light';

      const lang = language.toLowerCase();
      const aliases: Record<string, string> = {
        js: 'javascript',
        ts: 'typescript',
        py: 'python',
        sh: 'bash',
        yml: 'yaml',
        md: 'markdown',
        text: 'plaintext',
      };
      const normalizedLang = aliases[lang] || lang;

      const html = highlighter.codeToHtml(normalizedCode, {
        lang: normalizedLang as any,
        theme: themeName,
      });

      highlightedHtml = html;
    } catch (err) {
      console.warn('Syntax highlighting failed:', err);
    }
  }

  // Set up theme observer on mount
  $effect(() => {
    if (typeof window === 'undefined') return;

    // Set up observer for theme changes
    setupThemeObserver();

    // Initial theme detection
    theme = detectTheme();

    // Cleanup
    return () => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    };
  });

  // Re-highlight when code, language, or theme changes
  $effect(() => {
    if (typeof window === 'undefined') return;

    // Track dependencies by referencing reactive values
    void normalizedCode;
    void language;
    void theme;

    highlight();
  });
</script>

<div
  class="ui-code-block {className}"
  style="
    background: var(--bg-3);
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    overflow: hidden;
    font-family: var(--font-mono);
    font-size: 0.875rem;
  "
>
  {#if filename || copyable}
    <div class="header">
      <span class="filename">
        {filename || language}
      </span>
      {#if copyable}
        <CopyButton text={code} size="sm" variant="ghost" iconOnly />
      {/if}
    </div>
  {/if}

  <div class="code-container" style={maxHeight ? `max-height: ${maxHeight};` : ''}>
    {#if showLineNumbers}
      <div class="with-line-numbers">
        <div class="line-numbers">
          {#each lines as _, i}
            <div class="line-number" class:highlighted={highlightSet.has(i + 1)}>
              {i + 1}
            </div>
          {/each}
        </div>
        <div class="code-lines">
          {#if highlightedHtml}
            <div class="highlighted-code">
              {@html highlightedHtml}
            </div>
          {:else}
            {#each lines as line, i}
              <div class="line" class:highlighted={highlightSet.has(i + 1)}>
                {line || ' '}
              </div>
            {/each}
          {/if}
        </div>
      </div>
    {:else}
      {#if highlightedHtml}
        <div class="highlighted-code no-line-numbers">
          {@html highlightedHtml}
        </div>
      {:else}
        <pre class="plain-code"><code>{normalizedCode}</code></pre>
      {/if}
    {/if}
  </div>
</div>

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: var(--bg-2);
    border-bottom: 1px solid var(--ui);
  }

  .filename {
    font-size: 0.75rem;
    color: var(--tx-3);
    font-family: var(--font-ui);
  }

  .code-container {
    overflow: auto;
  }

  .with-line-numbers {
    display: flex;
  }

  .line-numbers {
    padding: 1rem 0;
    background: var(--bg-2);
    border-right: 1px solid var(--ui);
    user-select: none;
    text-align: right;
    flex-shrink: 0;
  }

  .line-number {
    padding: 0 0.75rem;
    color: var(--tx-3);
    font-size: 0.75rem;
    line-height: 1.5rem;
  }

  .line-number.highlighted {
    background: var(--bg-3);
  }

  .code-lines {
    flex: 1;
    overflow-x: auto;
    min-width: 0;
  }

  .line {
    padding: 0 1rem;
    line-height: 1.5rem;
    white-space: pre;
    color: var(--tx);
  }

  .line.highlighted {
    background: oklch(from var(--primary) l c h / 0.1);
  }

  .plain-code {
    margin: 0;
    padding: 1rem;
    white-space: pre;
    overflow-x: auto;
    color: var(--tx);
    line-height: 1.5;
  }

  .plain-code code {
    font-family: inherit;
  }

  .highlighted-code {
    padding: 1rem;
  }

  .highlighted-code.no-line-numbers {
    padding: 1rem;
  }

  .highlighted-code :global(pre) {
    margin: 0;
    padding: 0;
    background: transparent !important;
    overflow-x: auto;
  }

  .highlighted-code :global(code) {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .highlighted-code :global(.shiki) {
    background: transparent !important;
  }
</style>
