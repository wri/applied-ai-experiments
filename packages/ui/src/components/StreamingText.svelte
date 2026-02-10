<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    text: string;
    speed?: number;
    delay?: number;
    paused?: boolean;
    cursor?: boolean;
    onComplete?: () => void;
    class?: string;
  }

  let {
    text,
    speed = 50,
    delay = 0,
    paused = false,
    cursor = true,
    onComplete,
    class: className = '',
  }: Props = $props();

  let revealedCount = $state(0);
  let isComplete = $state(false);
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  // Use $derived for displayed text
  const displayedText = $derived(text.slice(0, revealedCount));

  function tick() {
    if (paused) return;

    if (revealedCount < text.length) {
      revealedCount = revealedCount + 1;
    }

    if (revealedCount >= text.length && !isComplete) {
      isComplete = true;
      stopStreaming();
      onComplete?.();
    }
  }

  function startStreaming() {
    if (intervalId) return;

    const msPerChar = 1000 / speed;
    intervalId = setInterval(tick, msPerChar);
  }

  function stopStreaming() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  // Handle pause changes
  $effect(() => {
    if (paused) {
      stopStreaming();
    } else if (!isComplete && intervalId === null) {
      startStreaming();
    }
  });

  onMount(() => {
    // Start after delay
    if (delay > 0) {
      timeoutId = setTimeout(() => {
        if (!paused) startStreaming();
      }, delay);
    } else {
      if (!paused) startStreaming();
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      stopStreaming();
    };
  });
</script>

<span class="ui-streaming-text {className}">
  <span class="text">{displayedText}</span>{#if cursor && !isComplete}<span class="cursor"></span>{/if}
</span>

<style>
  .ui-streaming-text {
    display: inline;
  }

  .text {
    white-space: pre-wrap;
  }

  .cursor {
    display: inline-block;
    width: 2px;
    height: 1em;
    background: var(--primary);
    margin-left: 1px;
    vertical-align: text-bottom;
    animation: blink 1s step-end infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
</style>
