<script lang="ts" module>
  export const meta = {
    title: 'ThinkingSummary',
    description: 'Collapsible panel for displaying AI reasoning/thinking content',
    category: 'AI Components',
  };
</script>

<script lang="ts">
  import ThinkingSummary from './ThinkingSummary.svelte';
  import { onMount } from 'svelte';

  const shortContent = `Let me analyze this step by step:
1. First, I need to understand the problem
2. The user wants to reverse a string
3. I can use Python's slice notation`;

  const longContent = `Let me think through this problem systematically.

First, I need to understand what the user is asking for. They want to implement a function that checks if a number is prime. A prime number is a natural number greater than 1 that has no positive divisors other than 1 and itself.

Key considerations:
1. Numbers less than or equal to 1 are not prime
2. 2 is the only even prime number
3. We only need to check divisors up to the square root of n
4. We can optimize by checking 2 separately and then only odd numbers

Algorithm approach:
- Return false for n <= 1
- Return true for n == 2
- Return false for even numbers > 2
- Check odd divisors from 3 to sqrt(n)

Let me also consider edge cases:
- Negative numbers should return false
- Very large numbers need efficient checking
- The function should handle integer overflow for extremely large inputs

I'll implement this with the optimized approach that checks up to sqrt(n), which gives us O(sqrt(n)) time complexity instead of O(n).

Additionally, I should consider:
- Input validation
- Type hints for better code documentation
- A clear docstring explaining the function

The implementation will be clean and efficient, following Python best practices.`;

  // Streaming simulation state
  let streamingContent = $state('');
  let isStreaming = $state(true);
  let streamInterval: ReturnType<typeof setInterval> | null = null;

  const fullStreamContent = `Analyzing the request...

Step 1: Parse the input parameters
Step 2: Validate the data structure
Step 3: Apply the transformation
Step 4: Return the result

This approach ensures correctness while maintaining efficiency.`;

  onMount(() => {
    let index = 0;
    streamInterval = setInterval(() => {
      if (index < fullStreamContent.length) {
        streamingContent = fullStreamContent.slice(0, index + 1);
        index++;
      } else {
        isStreaming = false;
        if (streamInterval) {
          clearInterval(streamInterval);
        }
      }
    }, 50);

    return () => {
      if (streamInterval) {
        clearInterval(streamInterval);
      }
    };
  });
</script>

<section>
  <h3>Default (Collapsed)</h3>
  <div style="max-width: 500px;">
    <ThinkingSummary content={shortContent} />
  </div>
</section>

<section>
  <h3>Expanded</h3>
  <div style="max-width: 500px;">
    <ThinkingSummary content={shortContent} collapsed={false} />
  </div>
</section>

<section>
  <h3>Long Content with Scrolling</h3>
  <div style="max-width: 500px;">
    <ThinkingSummary content={longContent} collapsed={false} />
  </div>
</section>

<section>
  <h3>Streaming</h3>
  <p style="font-size: 0.875rem; color: var(--tx-2); margin-bottom: 0.5rem;">
    Simulated streaming content with pulsing indicator
  </p>
  <div style="max-width: 500px;">
    <ThinkingSummary
      content={streamingContent}
      streaming={isStreaming}
      collapsed={false}
    />
  </div>
</section>

<section>
  <h3>Custom Label</h3>
  <div style="max-width: 500px;">
    <ThinkingSummary content={shortContent} label="Thinking Process" />
  </div>
</section>

<section>
  <h3>Without Character Count</h3>
  <div style="max-width: 500px;">
    <ThinkingSummary content={shortContent} showCharCount={false} />
  </div>
</section>

<section>
  <h3>Empty Content</h3>
  <div style="max-width: 500px;">
    <ThinkingSummary content="" streaming={true} />
  </div>
</section>

<section>
  <h3>Provider Labels</h3>
  <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 500px;">
    <ThinkingSummary content={shortContent} label="Extended Thinking" />
    <ThinkingSummary content={shortContent} label="Reasoning Summary" />
    <ThinkingSummary content={shortContent} label="Thoughts" />
  </div>
</section>
