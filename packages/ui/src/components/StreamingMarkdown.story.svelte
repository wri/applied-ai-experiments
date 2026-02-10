<script lang="ts" module>
  export const meta = {
    title: 'StreamingMarkdown',
    description: 'Progressive markdown rendering for LLM streaming responses',
    category: 'AI Components',
  };
</script>

<script lang="ts">
  import StreamingMarkdown from './StreamingMarkdown.svelte';
  import Button from './Button.svelte';
  import LatencyBadge from './LatencyBadge.svelte';
  import TokenCounter from './TokenCounter.svelte';

  // Simulated LLM response content
  const llmResponse = `## Understanding Async/Await in JavaScript

Async/await is syntactic sugar built on top of Promises that makes asynchronous code easier to write and read.

### Key Concepts

1. **async functions** always return a Promise
2. **await** pauses execution until the Promise resolves
3. Error handling works with standard try/catch

### Example

Here's a practical example of fetching data:

\`\`\`javascript
async function fetchUserData(userId) {
  try {
    const response = await fetch(\`/api/users/\${userId}\`);

    if (!response.ok) {
      throw new Error('User not found');
    }

    const user = await response.json();
    return user;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw error;
  }
}

// Usage
const user = await fetchUserData(123);
console.log(user.name);
\`\`\`

### Best Practices

- Always handle errors with try/catch
- Use \`Promise.all()\` for parallel requests
- Avoid mixing callbacks with async/await

> **Tip:** Async/await makes debugging easier because stack traces are more readable than with raw Promises.`;

  const codeOnlyResponse = `Here's a Python implementation of binary search:

\`\`\`python
def binary_search(arr: list[int], target: int) -> int:
    """
    Search for target in sorted array.
    Returns index if found, -1 otherwise.
    """
    left, right = 0, len(arr) - 1

    while left <= right:
        mid = (left + right) // 2

        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1

    return -1

# Example usage
numbers = [1, 3, 5, 7, 9, 11, 13]
result = binary_search(numbers, 7)
print(f"Found at index: {result}")  # Output: Found at index: 3
\`\`\`

The time complexity is O(log n) and space complexity is O(1).`;

  const shortResponse = `The capital of France is **Paris**. It's known for the Eiffel Tower, the Louvre Museum, and its rich cultural heritage.`;

  // Streaming state
  let content = $state('');
  let streaming = $state(false);
  let startTime = $state(0);
  let elapsedMs = $state(0);
  let tokenCount = $state(0);
  let currentDemo = $state<'full' | 'code' | 'short'>('full');

  // Chunk simulation settings
  let chunkSize = $state(15); // characters per chunk
  let chunkDelayMs = $state(50); // ms between chunks

  let streamInterval: ReturnType<typeof setInterval> | null = null;
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  function getResponseContent(): string {
    switch (currentDemo) {
      case 'code': return codeOnlyResponse;
      case 'short': return shortResponse;
      default: return llmResponse;
    }
  }

  function startStreaming() {
    const fullContent = getResponseContent();
    content = '';
    streaming = true;
    startTime = Date.now();
    tokenCount = 0;
    elapsedMs = 0;

    // Update elapsed time
    timerInterval = setInterval(() => {
      elapsedMs = Date.now() - startTime;
    }, 100);

    let position = 0;

    // Simulate chunked streaming with variable chunk sizes
    streamInterval = setInterval(() => {
      if (position >= fullContent.length) {
        stopStreaming();
        return;
      }

      // Variable chunk size (simulates real API behavior)
      const variance = Math.floor(Math.random() * 10) - 5;
      const actualChunkSize = Math.max(1, chunkSize + variance);
      const chunk = fullContent.slice(position, position + actualChunkSize);

      content += chunk;
      position += actualChunkSize;

      // Rough token estimate (1 token ≈ 4 chars)
      tokenCount = Math.floor(content.length / 4);
    }, chunkDelayMs);
  }

  function stopStreaming() {
    streaming = false;
    if (streamInterval) {
      clearInterval(streamInterval);
      streamInterval = null;
    }
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function reset() {
    stopStreaming();
    content = '';
    elapsedMs = 0;
    tokenCount = 0;
  }
</script>

<section>
  <h3>Simulated LLM Response</h3>
  <p style="margin-bottom: 1rem; color: var(--tx-2); font-size: var(--font-size-sm);">
    Demonstrates how markdown content streams from an LLM API with realistic chunking behavior.
  </p>

  <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
    <Button
      onclick={() => { currentDemo = 'full'; reset(); }}
      variant={currentDemo === 'full' ? 'primary' : 'secondary'}
      size="sm"
    >
      Full Response
    </Button>
    <Button
      onclick={() => { currentDemo = 'code'; reset(); }}
      variant={currentDemo === 'code' ? 'primary' : 'secondary'}
      size="sm"
    >
      Code Heavy
    </Button>
    <Button
      onclick={() => { currentDemo = 'short'; reset(); }}
      variant={currentDemo === 'short' ? 'primary' : 'secondary'}
      size="sm"
    >
      Short Answer
    </Button>
  </div>

  <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
    {#if !streaming}
      <Button onclick={startStreaming} variant="primary" size="sm">
        ▶ Start Streaming
      </Button>
    {:else}
      <Button onclick={stopStreaming} variant="secondary" size="sm">
        ⏹ Stop
      </Button>
    {/if}
    <Button onclick={reset} variant="ghost" size="sm" disabled={streaming}>
      Reset
    </Button>
  </div>

  <!-- Metadata display -->
  {#if content || streaming}
    <div style="
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
      padding: 0.5rem 0.75rem;
      background: var(--bg-2);
      border-radius: var(--radius-sm);
      font-family: var(--font-mono);
      font-size: 0.75rem;
      align-items: center;
    ">
      <span style="color: var(--tx-3);">
        {streaming ? '● Streaming' : '○ Complete'}
      </span>
      <LatencyBadge ms={elapsedMs} size="sm" />
      <TokenCounter tokens={tokenCount} size="sm" />
    </div>
  {/if}

  <!-- Streaming content -->
  <div style="
    padding: 1.5rem;
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    min-height: 200px;
    max-height: 500px;
    overflow-y: auto;
  ">
    {#if content}
      <StreamingMarkdown {content} {streaming} />
    {:else}
      <p style="color: var(--tx-3); font-style: italic; margin: 0;">
        Click "Start Streaming" to begin...
      </p>
    {/if}
  </div>
</section>

<section>
  <h3>Streaming Settings</h3>
  <p style="margin-bottom: 1rem; color: var(--tx-2); font-size: var(--font-size-sm);">
    Adjust chunk size and delay to simulate different network conditions.
  </p>

  <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
    <label style="display: flex; flex-direction: column; gap: 0.25rem;">
      <span style="font-family: var(--font-ui); font-size: 0.75rem; color: var(--tx-3);">
        Chunk Size (chars)
      </span>
      <input
        type="range"
        min="5"
        max="50"
        bind:value={chunkSize}
        style="width: 150px;"
      />
      <span style="font-family: var(--font-mono); font-size: 0.875rem;">{chunkSize}</span>
    </label>

    <label style="display: flex; flex-direction: column; gap: 0.25rem;">
      <span style="font-family: var(--font-ui); font-size: 0.75rem; color: var(--tx-3);">
        Chunk Delay (ms)
      </span>
      <input
        type="range"
        min="10"
        max="200"
        bind:value={chunkDelayMs}
        style="width: 150px;"
      />
      <span style="font-family: var(--font-mono); font-size: 0.875rem;">{chunkDelayMs}ms</span>
    </label>
  </div>
</section>

<section>
  <h3>Handling Partial Markdown</h3>
  <p style="margin-bottom: 1rem; color: var(--tx-2); font-size: var(--font-size-sm);">
    The component handles incomplete markdown gracefully - unclosed code fences and inline code are automatically closed during streaming.
  </p>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
    <div>
      <p style="margin: 0 0 0.5rem 0; font-family: var(--font-ui); font-size: 0.75rem; color: var(--tx-3);">
        Partial code fence (streaming)
      </p>
      <div style="padding: 1rem; background: var(--bg-2); border-radius: var(--radius-md);">
        <StreamingMarkdown
          content="Here's some code:\n\n```python\ndef hello():\n    print('Hello"
          streaming={true}
        />
      </div>
    </div>

    <div>
      <p style="margin: 0 0 0.5rem 0; font-family: var(--font-ui); font-size: 0.75rem; color: var(--tx-3);">
        Complete code fence
      </p>
      <div style="padding: 1rem; background: var(--bg-2); border-radius: var(--radius-md);">
        <StreamingMarkdown
          content="Here's some code:\n\n```python\ndef hello():\n    print('Hello')\n```"
          streaming={false}
        />
      </div>
    </div>
  </div>
</section>

<section>
  <h3>Static Usage</h3>
  <p style="margin-bottom: 1rem; color: var(--tx-2); font-size: var(--font-size-sm);">
    Can also be used for static markdown content with <code>streaming=false</code>.
  </p>

  <div style="padding: 1rem; background: var(--bg-2); border-radius: var(--radius-md); max-width: 600px;">
    <StreamingMarkdown
      content="This is **static content** with `inline code` and:\n\n- List item 1\n- List item 2\n\n> A blockquote for emphasis"
      streaming={false}
    />
  </div>
</section>
