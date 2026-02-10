<script lang="ts" module>
  export const meta = {
    title: 'CodeBlock',
    description: 'Syntax-highlighted code display with copy functionality',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import CodeBlock from './CodeBlock.svelte';

  const jsCode = `function greet(name) {
  console.log(\`Hello, \${name}!\`);
  return { greeting: name };
}

greet('World');`;

  const pythonCode = `def calculate_metrics(data: list[float]) -> dict:
    """Calculate basic statistics for the given data."""
    total = sum(data)
    count = len(data)
    average = total / count if count > 0 else 0

    return {
        'total': total,
        'count': count,
        'average': average,
        'min': min(data) if data else None,
        'max': max(data) if data else None,
    }

results = calculate_metrics([1.5, 2.3, 4.1, 3.8])
print(results)`;

  const tsCode = `interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

async function fetchUser(id: string): Promise<User | null> {
  const response = await fetch(\`/api/users/\${id}\`);

  if (!response.ok) {
    return null;
  }

  return response.json();
}`;

  const jsonCode = `{
  "model": "claude-opus-4-5-20251101",
  "temperature": 0.7,
  "max_tokens": 4096,
  "messages": [
    {
      "role": "user",
      "content": "Explain quantum computing"
    }
  ]
}`;

  const bashCode = `#!/bin/bash

# Deploy script
echo "Starting deployment..."

npm run build
npm run test

if [ $? -eq 0 ]; then
  echo "Tests passed, deploying..."
  npm run deploy
else
  echo "Tests failed, aborting deployment"
  exit 1
fi`;
</script>

<section>
  <h3>Languages</h3>
  <div style="display: flex; flex-direction: column; gap: 1.5rem;">
    <div>
      <p style="margin: 0 0 0.5rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">JavaScript</p>
      <CodeBlock code={jsCode} language="javascript" />
    </div>
    <div>
      <p style="margin: 0 0 0.5rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">Python</p>
      <CodeBlock code={pythonCode} language="python" />
    </div>
    <div>
      <p style="margin: 0 0 0.5rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">TypeScript</p>
      <CodeBlock code={tsCode} language="typescript" />
    </div>
  </div>
</section>

<section>
  <h3>Line Numbers</h3>
  <CodeBlock
    code={jsCode}
    language="javascript"
    showLineNumbers
    filename="greeting.js"
  />
</section>

<section>
  <h3>Line Highlighting</h3>
  <CodeBlock
    code={pythonCode}
    language="python"
    showLineNumbers
    highlightLines={[2, 3, 4, 5]}
    filename="metrics.py"
  />
</section>

<section>
  <h3>With Filename</h3>
  <div style="display: flex; flex-direction: column; gap: 1rem;">
    <CodeBlock code={jsonCode} language="json" filename="config.json" />
    <CodeBlock code={bashCode} language="bash" filename="deploy.sh" />
  </div>
</section>

<section>
  <h3>Without Copy Button</h3>
  <CodeBlock code={jsCode} language="javascript" copyable={false} />
</section>

<section>
  <h3>Scrollable with Max Height</h3>
  <CodeBlock
    code={pythonCode + '\n\n' + pythonCode}
    language="python"
    maxHeight="200px"
    showLineNumbers
    filename="long-file.py"
  />
</section>

<section>
  <h3>Plain Text</h3>
  <CodeBlock
    code={`This is plain text content.
No syntax highlighting applied.
Just monospace formatting.`}
    language="text"
  />
</section>

<section>
  <h3>Inline Code Comparison</h3>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
    <CodeBlock
      code={`const x = 1;`}
      language="javascript"
      filename="Before"
    />
    <CodeBlock
      code={`const x = 42;`}
      language="javascript"
      filename="After"
    />
  </div>
</section>
