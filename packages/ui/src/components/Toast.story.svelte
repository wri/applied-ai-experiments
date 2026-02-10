<script lang="ts" module>
  export const meta = {
    title: 'Toast',
    description: 'Notification system with variants, actions, and positioning',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import { ToastContainer, toast } from './toast';
  import Button from './Button.svelte';

  let position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center' = $state('bottom-right');

  function showInfo() {
    toast.info('This is an informational message.');
  }

  function showSuccess() {
    toast.success('Operation completed successfully!');
  }

  function showWarning() {
    toast.warning('Please review your settings.');
  }

  function showError() {
    toast.error('An error occurred. Please try again.');
  }

  function showWithAction() {
    toast.info('New version available.', {
      action: {
        label: 'Update',
        onclick: () => alert('Updating...'),
      },
      duration: 0,
    });
  }

  function showPersistent() {
    toast.warning('This toast will not auto-dismiss.', {
      duration: 0,
    });
  }

  function showQuick() {
    toast.success('Quick notification!', {
      duration: 2000,
    });
  }

  function showNonDismissible() {
    toast.info('Processing... Please wait.', {
      dismissible: false,
      duration: 3000,
    });
  }

  function showMultiple() {
    toast.info('First notification');
    setTimeout(() => toast.success('Second notification'), 200);
    setTimeout(() => toast.warning('Third notification'), 400);
  }

  function clearAll() {
    toast.clear();
  }
</script>

<ToastContainer {position} />

<section>
  <h3>Variants</h3>
  <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
    <Button onclick={showInfo} variant="secondary">Info</Button>
    <Button onclick={showSuccess} variant="secondary">Success</Button>
    <Button onclick={showWarning} variant="secondary">Warning</Button>
    <Button onclick={showError} variant="secondary">Error</Button>
  </div>
</section>

<section>
  <h3>With Action</h3>
  <p style="margin-bottom: 1rem; font-size: var(--font-size-sm); color: var(--tx-2);">
    Toasts can include action buttons for user interaction.
  </p>
  <Button onclick={showWithAction} variant="secondary">Show Toast with Action</Button>
</section>

<section>
  <h3>Duration</h3>
  <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
    <Button onclick={showQuick} variant="secondary">Quick (2s)</Button>
    <Button onclick={showInfo} variant="secondary">Normal (5s)</Button>
    <Button onclick={showPersistent} variant="secondary">Persistent</Button>
  </div>
</section>

<section>
  <h3>Non-dismissible</h3>
  <p style="margin-bottom: 1rem; font-size: var(--font-size-sm); color: var(--tx-2);">
    Toasts without a dismiss button (useful for loading states).
  </p>
  <Button onclick={showNonDismissible} variant="secondary">Show Non-dismissible</Button>
</section>

<section>
  <h3>Stacking</h3>
  <div style="display: flex; gap: 1rem;">
    <Button onclick={showMultiple} variant="secondary">Show Multiple</Button>
    <Button onclick={clearAll} variant="ghost">Clear All</Button>
  </div>
</section>

<section>
  <h3>Position</h3>
  <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
    {#each ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'] as pos}
      <button
        type="button"
        onclick={() => { position = pos as typeof position; }}
        style="
          padding: 0.5rem 0.75rem;
          font-family: var(--font-ui);
          font-size: 0.75rem;
          background: {position === pos ? 'var(--primary)' : 'var(--bg-3)'};
          color: {position === pos ? 'var(--primary-content)' : 'var(--tx)'};
          border: 1px solid {position === pos ? 'var(--primary)' : 'var(--ui)'};
          border-radius: var(--radius-sm);
          cursor: pointer;
        "
      >
        {pos}
      </button>
    {/each}
  </div>
  <p style="margin-top: 0.5rem; font-size: var(--font-size-sm); color: var(--tx-3);">
    Current: {position}
  </p>
</section>

<section>
  <h3>Interactive Demo</h3>
  <div style="
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    max-width: 500px;
  ">
    <h4 style="margin: 0 0 1rem 0; font-family: var(--font-ui);">Notification Demo</h4>
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      <Button onclick={() => toast.success('File saved successfully!')} variant="primary">
        Save File
      </Button>
      <Button onclick={() => toast.error('Failed to connect to server.', { duration: 0, action: { label: 'Retry', onclick: () => toast.info('Retrying...') } })} variant="secondary">
        Simulate Error
      </Button>
      <Button onclick={() => toast.warning('Your session will expire in 5 minutes.')} variant="ghost">
        Session Warning
      </Button>
    </div>
  </div>
</section>
