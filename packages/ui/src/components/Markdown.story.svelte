<script lang="ts" module>
  export const meta = {
    title: 'Markdown',
    description: 'Render markdown content with syntax-highlighted code blocks',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import Markdown from './Markdown.svelte';

  const headingsExample = `# Heading 1
## Heading 2
### Heading 3
#### Heading 4

This is regular paragraph text.`;

  const listsExample = `## Lists

### Unordered List
- First item
- Second item
  - Nested item
  - Another nested
- Third item

### Ordered List
1. First step
2. Second step
3. Third step

### Task List
- [x] Completed task
- [ ] Pending task
- [ ] Another pending`;

  const codeExample = `## Code Examples

Inline code: \`const x = 42;\`

### JavaScript
\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}
\`\`\`

### Python
\`\`\`python
def calculate(x, y):
    return x + y

result = calculate(5, 3)
print(f"Result: {result}")
\`\`\``;

  const tableExample = `## Tables

| Model | Context | Price |
|-------|---------|-------|
| claude-opus-4-5-20251101 | 200K | $15/1M |
| Claude 3.5 Sonnet | 200K | $3/1M |
| Claude 3 Haiku | 200K | $0.25/1M |`;

  const fullDocument = `# API Documentation

This document describes the **Model API** endpoints.

## Authentication

All requests require an API key in the \`Authorization\` header:

\`\`\`bash
curl -X POST https://api.example.com/v1/messages \\
  -H "Authorization: Bearer sk-..." \\
  -H "Content-Type: application/json"
\`\`\`

## Endpoints

### Create Message

\`POST /v1/messages\`

Creates a new message with the specified model.

#### Request Body

\`\`\`json
{
  "model": "claude-opus-4-5-20251101",
  "max_tokens": 1024,
  "messages": [
    { "role": "user", "content": "Hello!" }
  ]
}
\`\`\`

#### Response

\`\`\`json
{
  "id": "msg_123",
  "content": [
    { "type": "text", "text": "Hello! How can I help?" }
  ],
  "usage": {
    "input_tokens": 10,
    "output_tokens": 15
  }
}
\`\`\`

## Rate Limits

| Tier | Requests/min | Tokens/day |
|------|-------------|------------|
| Free | 10 | 100K |
| Pro | 100 | 1M |
| Enterprise | 1000 | Unlimited |

> **Note:** Rate limits are applied per API key, not per user.

---

## Error Handling

Common error codes:

- \`400\` - Bad Request
- \`401\` - Unauthorized
- \`429\` - Rate Limited
- \`500\` - Server Error

For more details, see the [Error Reference](#).`;

  const blockquoteExample = `## Blockquotes

> This is a simple blockquote.
> It can span multiple lines.

> **Important:** Blockquotes can contain *formatted* text and even \`inline code\`.`;
</script>

<section>
  <h3>Headings</h3>
  <div style="max-width: 600px; background: var(--bg-2); padding: 1.5rem; border-radius: var(--radius-md);">
    <Markdown content={headingsExample} />
  </div>
</section>

<section>
  <h3>Lists</h3>
  <div style="max-width: 600px; background: var(--bg-2); padding: 1.5rem; border-radius: var(--radius-md);">
    <Markdown content={listsExample} />
  </div>
</section>

<section>
  <h3>Code Blocks</h3>
  <div style="max-width: 600px; background: var(--bg-2); padding: 1.5rem; border-radius: var(--radius-md);">
    <Markdown content={codeExample} />
  </div>
</section>

<section>
  <h3>Tables</h3>
  <div style="max-width: 600px; background: var(--bg-2); padding: 1.5rem; border-radius: var(--radius-md);">
    <Markdown content={tableExample} />
  </div>
</section>

<section>
  <h3>Blockquotes</h3>
  <div style="max-width: 600px; background: var(--bg-2); padding: 1.5rem; border-radius: var(--radius-md);">
    <Markdown content={blockquoteExample} />
  </div>
</section>

<section>
  <h3>Full Document</h3>
  <div style="max-width: 700px; background: var(--bg-2); padding: 2rem; border-radius: var(--radius-md); border: 1px solid var(--ui);">
    <Markdown content={fullDocument} />
  </div>
</section>
