/**
 * Shiki syntax highlighter singleton
 * Lazily initializes and caches the highlighter instance
 */

import { createHighlighter, type HighlighterGeneric, type BundledLanguage, type BundledTheme } from 'shiki';

let highlighterPromise: Promise<HighlighterGeneric<BundledLanguage, BundledTheme>> | null = null;
let highlighterInstance: HighlighterGeneric<BundledLanguage, BundledTheme> | null = null;

const SUPPORTED_LANGUAGES: BundledLanguage[] = [
  'javascript',
  'typescript',
  'python',
  'json',
  'html',
  'css',
  'bash',
  'shell',
  'markdown',
  'yaml',
  'sql',
  'rust',
  'go',
  'java',
  'c',
  'cpp',
];

const THEMES: BundledTheme[] = ['github-dark', 'github-light'];

/**
 * Get or create the shiki highlighter instance
 */
export async function getHighlighter(): Promise<HighlighterGeneric<BundledLanguage, BundledTheme>> {
  if (highlighterInstance) {
    return highlighterInstance;
  }

  if (!highlighterPromise) {
    highlighterPromise = initHighlighter();
  }

  return highlighterPromise;
}

async function initHighlighter(): Promise<HighlighterGeneric<BundledLanguage, BundledTheme>> {
  highlighterInstance = await createHighlighter({
    themes: THEMES,
    langs: SUPPORTED_LANGUAGES,
  });
  return highlighterInstance;
}

/**
 * Check if highlighter is ready (already loaded)
 */
export function isHighlighterReady(): boolean {
  return highlighterInstance !== null;
}

/**
 * Highlight code with the given language
 * Returns HTML string with syntax highlighting
 */
export async function highlightCode(
  code: string,
  language: string,
  theme: 'dark' | 'light' = 'dark'
): Promise<string> {
  const highlighter = await getHighlighter();

  const lang = normalizeLanguage(language);
  const themeName = theme === 'dark' ? 'github-dark' : 'github-light';

  try {
    return highlighter.codeToHtml(code, {
      lang: lang as BundledLanguage,
      theme: themeName,
    });
  } catch {
    // If the language isn't supported, wrap code in a pre tag without highlighting
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<pre class="shiki" style="background-color: transparent;"><code>${escaped}</code></pre>`;
  }
}

function normalizeLanguage(lang: string): string {
  const aliases: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    sh: 'bash',
    yml: 'yaml',
    md: 'markdown',
    text: 'plaintext',
  };

  const normalized = lang.toLowerCase();
  return aliases[normalized] || normalized;
}
