<script lang="ts">
  import { onMount } from 'svelte';
  import HeaderButton from './HeaderButton.svelte';
  import Modal from './Modal.svelte';

  /**
   * The "what is this?" affordance every demo header carries.
   *
   * The body text is the experiment's description, which lives in the brief's lede
   * blockquote. Rather than add a per-demo build step to import it, the default
   * source is the demo's own `<meta name="description">` — which
   * `.github/scripts/sync-demo-meta.py` already generates from the brief into
   * `src/app.html`. So the brief stays the single source of truth and there is
   * nothing new to keep in sync.
   *
   * Pass `description` explicitly to override (e.g. a demo that isn't
   * meta-synced, or a story/test render).
   */
  interface Props {
    /** Experiment title — the modal heading. */
    title: string;
    /** Overrides the app.html meta description when provided. */
    description?: string;
    /** Link to the experiment's hub detail page, if known. */
    href?: string;
    class?: string;
  }

  let { title, description, href, class: className = '' }: Props = $props();

  let open = $state(false);
  let metaDescription = $state<string | null>(null);

  onMount(() => {
    const el = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    metaDescription = el?.content?.trim() || null;
  });

  const body = $derived(description?.trim() || metaDescription);
</script>

<HeaderButton
  label="About this experiment"
  active={open}
  class={className}
  onclick={() => (open = true)}
>
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <circle cx="8" cy="8" r="6.25" />
    <path d="M8 7.25v4" />
    <path d="M8 4.75h.01" />
  </svg>
</HeaderButton>

<Modal bind:open {title} size="md">
  {#if body}
    <p class="info-body">{body}</p>
  {:else}
    <p class="info-body info-empty">
      No description available for this experiment yet.
    </p>
  {/if}

  {#if href}
    <a class="info-link" {href} target="_blank" rel="noopener noreferrer">
      Read the full brief &rarr;
    </a>
  {/if}
</Modal>

<style>
  /* Long-form reading scale, not the compact UI scale — DESIGN.md §3. */
  .info-body {
    margin: 0;
    font-family: var(--font-body);
    font-size: var(--text-prose-size);
    line-height: var(--text-prose-line-height);
    color: var(--tx);
    max-width: var(--text-prose-measure);
  }

  .info-empty {
    color: var(--tx-2);
  }

  .info-link {
    display: inline-block;
    margin-top: var(--space-4);
    font-family: var(--font-mono);
    font-size: var(--text-ui);
    color: var(--primary);
    text-decoration: none;
  }

  .info-link:hover {
    color: var(--primary-hover, var(--primary));
    text-decoration: underline;
  }
</style>
