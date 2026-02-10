<script lang="ts" module>
  export const meta = {
    title: 'JsonViewer',
    description: 'Collapsible JSON tree viewer with syntax coloring',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import JsonViewer from './JsonViewer.svelte';

  const simpleObject = {
    name: 'John Doe',
    age: 30,
    email: 'john@example.com',
    active: true,
  };

  const simpleArray = ['apple', 'banana', 'cherry', 'date'];

  const nestedData = {
    user: {
      id: 'usr_12345',
      profile: {
        firstName: 'Jane',
        lastName: 'Smith',
        avatar: null,
      },
      settings: {
        theme: 'dark',
        notifications: true,
        language: 'en',
      },
    },
    permissions: ['read', 'write', 'admin'],
    metadata: {
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-20T14:45:00Z',
    },
  };

  const apiResponse = {
    id: 'msg_01XFDUDYJgAACzvnptvVoYEL',
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: 'Hello! How can I help you today?',
      },
    ],
    model: 'claude-opus-4-5-20251101',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: 25,
      output_tokens: 12,
    },
  };

  const largeData = {
    items: Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      value: Math.random() * 100,
      tags: ['tag1', 'tag2'],
    })),
  };

  const mixedTypes = {
    string: 'Hello World',
    number: 42,
    float: 3.14159,
    boolean: true,
    null: null,
    array: [1, 2, 3],
    nested: { key: 'value' },
    longString: 'This is a very long string that will be truncated because it exceeds the maximum string length limit that we have set for display purposes.',
  };
</script>

<section>
  <h3>Simple Object</h3>
  <div style="max-width: 500px;">
    <JsonViewer data={simpleObject} />
  </div>
</section>

<section>
  <h3>Simple Array</h3>
  <div style="max-width: 500px;">
    <JsonViewer data={simpleArray} />
  </div>
</section>

<section>
  <h3>Nested Data</h3>
  <div style="max-width: 600px;">
    <JsonViewer data={nestedData} />
  </div>
</section>

<section>
  <h3>API Response</h3>
  <div style="max-width: 600px;">
    <JsonViewer data={apiResponse} initialExpandDepth={2} />
  </div>
</section>

<section>
  <h3>Large Data</h3>
  <p style="margin-bottom: 1rem; font-size: var(--font-size-sm); color: var(--tx-2);">
    Collapsed by default to handle large datasets efficiently.
  </p>
  <div style="max-width: 600px;">
    <JsonViewer data={largeData} initialExpandDepth={0} />
  </div>
</section>

<section>
  <h3>Expand Depths</h3>
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
    <div>
      <p style="margin: 0 0 0.5rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">Depth: 0</p>
      <JsonViewer data={nestedData} initialExpandDepth={0} copyable={false} />
    </div>
    <div>
      <p style="margin: 0 0 0.5rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">Depth: 1</p>
      <JsonViewer data={nestedData} initialExpandDepth={1} copyable={false} />
    </div>
    <div>
      <p style="margin: 0 0 0.5rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">Depth: 2</p>
      <JsonViewer data={nestedData} initialExpandDepth={2} copyable={false} />
    </div>
  </div>
</section>

<section>
  <h3>Type Colors</h3>
  <div style="max-width: 600px;">
    <JsonViewer data={mixedTypes} initialExpandDepth={2} />
  </div>
  <div style="margin-top: 1rem; display: flex; gap: 1.5rem; flex-wrap: wrap; font-size: var(--font-size-sm);">
    <span><span style="color: var(--success-text);">■</span> String</span>
    <span><span style="color: var(--info-text);">■</span> Number</span>
    <span><span style="color: oklch(0.7 0.15 300);">■</span> Boolean</span>
    <span><span style="color: var(--tx-3);">■</span> Null</span>
    <span><span style="color: var(--primary);">■</span> Key</span>
  </div>
</section>

<section>
  <h3>Without Copy Button</h3>
  <div style="max-width: 400px;">
    <JsonViewer data={simpleObject} copyable={false} />
  </div>
</section>
