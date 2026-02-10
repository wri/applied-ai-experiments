<script lang="ts" module>
  export const meta = {
    title: 'StreamingText',
    description: 'Simple character-by-character text reveal animation',
    category: 'AI Components',
  };
</script>

<script lang="ts">
  import StreamingText from './StreamingText.svelte';
  import Button from './Button.svelte';
  import Alert from './Alert.svelte';

  const shortText = 'Hello, World! This is a streaming text demo.';
  const typewriterText = 'The quick brown fox jumps over the lazy dog.';

  let key = $state(0);
  let paused = $state(false);

  function reset() {
    key++;
    paused = false;
  }
</script>

<section>
  <Alert variant="info">
    <strong>Note:</strong> For LLM streaming responses with markdown support, see the
    <a href="/streamingmarkdown" style="color: var(--primary);">StreamingMarkdown</a> component instead.
    This component is a simple character-by-character text reveal animation.
  </Alert>
</section>

<section>
  <h3>Basic Usage</h3>
  <div style="
    padding: 1rem;
    background: var(--bg-2);
    border-radius: var(--radius-md);
    max-width: 500px;
  ">
    {#key key}
      <StreamingText text={shortText} />
    {/key}
  </div>
  <Button onclick={reset} variant="ghost" size="sm" style="margin-top: 0.5rem;">
    Reset
  </Button>
</section>

<section>
  <h3>Typewriter Effect</h3>
  <p style="margin-bottom: 1rem; color: var(--tx-2); font-size: var(--font-size-sm);">
    Slower speed for a classic typewriter feel.
  </p>
  <div style="
    padding: 1rem;
    background: var(--bg-3);
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    max-width: 500px;
  ">
    {#key key}
      <StreamingText text={typewriterText} speed={20} />
    {/key}
  </div>
  <Button onclick={reset} variant="ghost" size="sm" style="margin-top: 0.5rem;">
    Reset
  </Button>
</section>

<section>
  <h3>Pause/Resume</h3>
  <div style="max-width: 500px;">
    <div style="padding: 1rem; background: var(--bg-2); border-radius: var(--radius-md);">
      {#key key}
        <StreamingText text="This text can be paused and resumed while streaming..." speed={30} {paused} />
      {/key}
    </div>
    <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
      <Button onclick={() => { paused = !paused; }} variant="secondary" size="sm">
        {paused ? 'Resume' : 'Pause'}
      </Button>
      <Button onclick={reset} variant="ghost" size="sm">
        Reset
      </Button>
    </div>
  </div>
</section>

<section>
  <h3>Without Cursor</h3>
  <div style="
    padding: 1rem;
    background: var(--bg-2);
    border-radius: var(--radius-md);
    max-width: 500px;
  ">
    {#key key}
      <StreamingText text="No cursor displayed..." cursor={false} />
    {/key}
  </div>
</section>
