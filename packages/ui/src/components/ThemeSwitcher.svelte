<script lang="ts">
  type Theme = 'light' | 'dark' | 'high-contrast';

  interface Props {
    target?: string;
    class?: string;
  }

  let {
    target = '[data-variant="prototype"]',
    class: className = '',
  }: Props = $props();

  let currentTheme = $state<Theme>('dark');

  function setTheme(theme: Theme) {
    currentTheme = theme;
    if (typeof document !== 'undefined') {
      const elements = document.querySelectorAll(target);
      elements.forEach((el) => {
        el.setAttribute('data-theme', theme);
      });
      localStorage.setItem('prototype-theme', theme);
    }
  }

  function handleClick(e: MouseEvent) {
    if (e.altKey) {
      // Option+Click: Toggle high-contrast mode
      if (currentTheme === 'high-contrast') {
        setTheme('dark');
      } else {
        setTheme('high-contrast');
      }
    } else {
      // Regular Click: Cycle light ↔ dark
      if (currentTheme === 'light') {
        setTheme('dark');
      } else if (currentTheme === 'dark') {
        setTheme('light');
      } else {
        // From high-contrast, go to light
        setTheme('light');
      }
    }
  }

  const VALID_THEMES: Theme[] = ['light', 'dark', 'high-contrast'];

  function resolveInitialTheme(): Theme {
    const stored = localStorage.getItem('prototype-theme') as Theme | null;
    if (stored && VALID_THEMES.includes(stored)) return stored;
    // The attribute may already be stamped by a pre-paint script in app.html
    const attr = document.documentElement.getAttribute('data-theme') as Theme | null;
    if (attr && VALID_THEMES.includes(attr)) return attr;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  if (typeof window !== 'undefined') {
    currentTheme = resolveInitialTheme();
  }

  // Apply on mount (and after every change): by effect time the [data-variant]
  // layout wrapper exists in the DOM, and effects flush before paint, so the
  // wrapper never renders in the wrong theme.
  $effect(() => {
    setTheme(currentTheme);
  });
</script>

<button
  type="button"
  class="ui-theme-toggle {className}"
  onclick={handleClick}
  aria-label="Toggle theme (Option+click for high contrast)"
  title="Toggle theme (⌥+click for high contrast)"
  style="
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: 1px solid var(--ui);
    border-radius: var(--radius-sm);
    background-color: var(--bg);
    color: var(--tx-2);
    cursor: pointer;
    transition: all 100ms ease;
  "
>
  <!-- Sun icon (shown in dark mode - click to go to light) -->
  <svg
    class="theme-icon sun-icon"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    style="display: {currentTheme === 'dark' ? 'block' : 'none'};"
  >
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>

  <!-- Moon icon (shown in light mode - click to go to dark) -->
  <svg
    class="theme-icon moon-icon"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    style="display: {currentTheme === 'light' ? 'block' : 'none'};"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>

  <!-- Contrast icon (shown in high-contrast mode) -->
  <svg
    class="theme-icon contrast-icon"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    style="display: {currentTheme === 'high-contrast' ? 'block' : 'none'};"
  >
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M12 2v20" fill="currentColor"></path>
    <path d="M12 2a10 10 0 0 1 0 20" fill="currentColor"></path>
  </svg>
</button>

<style>
  .ui-theme-toggle:hover {
    border-color: var(--ui-hover, var(--ui));
    color: var(--tx);
  }
</style>
