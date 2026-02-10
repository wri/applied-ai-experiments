<script lang="ts" module>
  export const meta = {
    title: 'EmptyState',
    description: 'Placeholder for empty content with optional actions',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import EmptyState from './EmptyState.svelte';
  import Button from './Button.svelte';
</script>

<section>
  <h3>Basic</h3>
  <div style="max-width: 400px; background-color: var(--bg-2); border-radius: 0.25rem;">
    <EmptyState
      title="No results found"
      description="Try adjusting your search or filters"
    />
  </div>
</section>

<section>
  <h3>With Custom Icon</h3>
  <div style="max-width: 400px; background-color: var(--bg-2); border-radius: 0.25rem;">
    <EmptyState
      title="No experiments yet"
      description="Create your first experiment to get started"
      icon="🧪"
    />
  </div>
</section>

<section>
  <h3>With Action Button</h3>
  <div style="max-width: 400px; background-color: var(--bg-2); border-radius: 0.25rem;">
    <EmptyState
      title="No API keys configured"
      description="Add an API key to start using AI models"
    >
      <Button variant="primary">Add API Key</Button>
    </EmptyState>
  </div>
</section>

<section>
  <h3>Multiple Actions</h3>
  <div style="max-width: 400px; background-color: var(--bg-2); border-radius: 0.25rem;">
    <EmptyState
      title="No datasets loaded"
      description="Upload a dataset or connect to a data source"
      icon="📊"
    >
      <div style="display: flex; gap: 0.5rem;">
        <Button variant="primary">Upload File</Button>
        <Button variant="secondary">Connect Source</Button>
      </div>
    </EmptyState>
  </div>
</section>

<section>
  <h3>Different Icons</h3>
  <div class="story-grid">
    <div style="background-color: var(--bg-2); border-radius: 0.25rem;">
      <EmptyState title="No messages" icon="💬" />
    </div>
    <div style="background-color: var(--bg-2); border-radius: 0.25rem;">
      <EmptyState title="No files" icon="📁" />
    </div>
    <div style="background-color: var(--bg-2); border-radius: 0.25rem;">
      <EmptyState title="No notifications" icon="🔔" />
    </div>
  </div>
</section>
