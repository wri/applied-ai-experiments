<script lang="ts" module>
  export const meta = {
    title: 'ChatMessage',
    description: 'Message bubble with metadata for chat interfaces',
    category: 'AI Components',
  };
</script>

<script lang="ts">
  import ChatMessage from './ChatMessage.svelte';

  const asyncAwaitContent = `Of course! Async/await is a way to write asynchronous code that looks and behaves more like synchronous code.

**Key concepts:**

1. \`async\` functions always return a Promise
2. \`await\` pauses execution until the Promise resolves
3. Error handling works with try/catch

\`\`\`javascript
async function fetchData() {
  const response = await fetch('/api/data');
  return response.json();
}
\`\`\``;

  const reverseStringContent = `Here's a simple Python function to reverse a string:

\`\`\`python
def reverse_string(s: str) -> str:
    return s[::-1]

# Example usage
print(reverse_string('hello'))  # Output: 'olleh'
\`\`\`

This uses Python's slice notation with a step of -1 to reverse the string efficiently.`;

  const loopContent = `Here's the loop-based approach:

\`\`\`python
def reverse_string_loop(s: str) -> str:
    result = ''
    for char in s:
        result = char + result
    return result
\`\`\`

Or using a more explicit index-based loop:

\`\`\`python
def reverse_string_index(s: str) -> str:
    result = []
    for i in range(len(s) - 1, -1, -1):
        result.append(s[i])
    return ''.join(result)
\`\`\``;

  const mlContent = `# Understanding Machine Learning

Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed.

## Types of Machine Learning

### 1. Supervised Learning
- Uses labeled data
- Examples: classification, regression
- Common algorithms: Linear Regression, Decision Trees, Neural Networks

### 2. Unsupervised Learning
- Works with unlabeled data
- Examples: clustering, dimensionality reduction
- Common algorithms: K-Means, PCA, Autoencoders

### 3. Reinforcement Learning
- Learns through trial and error
- Uses rewards and penalties
- Applications: game playing, robotics

## Key Concepts

| Concept | Description |
|---------|-------------|
| Features | Input variables used for prediction |
| Labels | Target values we want to predict |
| Training | Process of learning from data |
| Inference | Making predictions on new data |

> "Machine learning is the field of study that gives computers the ability to learn without being explicitly programmed." - Arthur Samuel`;
</script>

<section>
  <h3>Roles</h3>
  <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 600px;">
    <ChatMessage
      role="user"
      content="Hello! Can you help me understand how async/await works in JavaScript?"
      timestamp={new Date()}
    />
    <ChatMessage
      role="assistant"
      content={asyncAwaitContent}
      timestamp={new Date()}
      model="claude-opus-4-5-20251101"
      tokens={{ input: 25, output: 150 }}
      latency={1234}
    />
    <ChatMessage
      role="system"
      content="Conversation context updated"
      timestamp={new Date()}
    />
  </div>
</section>

<section>
  <h3>With Metadata</h3>
  <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 600px;">
    <ChatMessage
      role="assistant"
      content="Here's a detailed response with all the metadata displayed below the message."
      timestamp={new Date()}
      model="claude-3-5-sonnet"
      tokens={{ input: 1024, output: 2048 }}
      latency={856}
    />
  </div>
</section>

<section>
  <h3>Streaming Status</h3>
  <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 600px;">
    <ChatMessage
      role="user"
      content="What's the weather like today?"
      timestamp={new Date()}
    />
    <ChatMessage
      role="assistant"
      content="Let me check the current weather conditions for you..."
      status="streaming"
      model="claude-opus-4-5-20251101"
    />
  </div>
</section>

<section>
  <h3>Error State</h3>
  <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 600px;">
    <ChatMessage
      role="user"
      content="Generate a very long response"
      timestamp={new Date()}
    />
    <ChatMessage
      role="assistant"
      content=""
      status="error"
      model="claude-opus-4-5-20251101"
    />
  </div>
</section>

<section>
  <h3>Conversation Thread</h3>
  <div style="
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 600px;
    padding: 1rem;
    background: var(--bg);
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
  ">
    <ChatMessage
      role="system"
      content="You are a helpful coding assistant."
    />
    <ChatMessage
      role="user"
      content="Write a Python function to reverse a string"
      timestamp={new Date(Date.now() - 60000)}
    />
    <ChatMessage
      role="assistant"
      content={reverseStringContent}
      timestamp={new Date(Date.now() - 55000)}
      model="claude-opus-4-5-20251101"
      tokens={{ input: 45, output: 120 }}
      latency={650}
    />
    <ChatMessage
      role="user"
      content="Can you also show me how to do it with a loop?"
      timestamp={new Date(Date.now() - 30000)}
    />
    <ChatMessage
      role="assistant"
      content={loopContent}
      timestamp={new Date(Date.now() - 25000)}
      model="claude-opus-4-5-20251101"
      tokens={{ input: 180, output: 200 }}
      latency={890}
    />
  </div>
</section>

<section>
  <h3>Long Content</h3>
  <div style="max-width: 600px;">
    <ChatMessage
      role="assistant"
      content={mlContent}
      timestamp={new Date()}
      model="claude-opus-4-5-20251101"
      tokens={{ input: 50, output: 450 }}
      latency={2100}
    />
  </div>
</section>

<section>
  <h3>With Thinking/Reasoning</h3>
  <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 600px;">
    <ChatMessage
      role="user"
      content="Write a function to check if a number is prime"
      timestamp={new Date()}
    />
    <ChatMessage
      role="assistant"
      content={reverseStringContent}
      timestamp={new Date()}
      model="claude-opus-4-5-20251101"
      tokens={{ input: 45, output: 120 }}
      latency={2500}
      thinking="Let me think through this problem step by step.

First, I need to understand what makes a number prime:
1. A prime number is greater than 1
2. It has no positive divisors other than 1 and itself

For efficiency, I only need to check divisors up to sqrt(n) because if n = a * b and a <= b, then a <= sqrt(n).

I'll implement this with:
- Early return for n <= 1 (not prime)
- Special case for n == 2 (only even prime)
- Check odd numbers from 3 to sqrt(n)"
      thinkingCollapsed={false}
    />
  </div>
</section>

<section>
  <h3>Thinking Streaming</h3>
  <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 600px;">
    <ChatMessage
      role="user"
      content="Explain quantum computing"
      timestamp={new Date()}
    />
    <ChatMessage
      role="assistant"
      content=""
      status="streaming"
      model="o3-mini"
      thinking="Analyzing the question about quantum computing...

Key concepts to cover:
- Qubits vs classical bits
- Superposition and entanglement"
      thinkingStreaming={true}
      thinkingCollapsed={false}
    />
  </div>
</section>
