<script lang="ts" module>
  export const meta = {
    title: 'Modal',
    description: 'Dialog overlay with various sizes and configurations',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import Modal from './Modal.svelte';
  import Button from './Button.svelte';
  import Input from './Input.svelte';
  import Textarea from './Textarea.svelte';

  let basicOpen = $state(false);
  let smallOpen = $state(false);
  let largeOpen = $state(false);
  let fullOpen = $state(false);
  let formOpen = $state(false);
  let confirmOpen = $state(false);
  let scrollOpen = $state(false);
  let noCloseOpen = $state(false);
</script>

<section>
  <h3>Sizes</h3>
  <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
    <Button onclick={() => { smallOpen = true; }} variant="secondary">Small</Button>
    <Button onclick={() => { basicOpen = true; }} variant="secondary">Medium (default)</Button>
    <Button onclick={() => { largeOpen = true; }} variant="secondary">Large</Button>
    <Button onclick={() => { fullOpen = true; }} variant="secondary">Full</Button>
  </div>

  <Modal bind:open={smallOpen} title="Small Modal" size="sm">
    <p style="margin: 0; color: var(--tx-2);">
      This is a small modal dialog, useful for simple confirmations or alerts.
    </p>
  </Modal>

  <Modal bind:open={basicOpen} title="Medium Modal" size="md">
    <p style="margin: 0; color: var(--tx-2);">
      This is a medium-sized modal dialog. It's the default size and works well for most content.
    </p>
  </Modal>

  <Modal bind:open={largeOpen} title="Large Modal" size="lg">
    <p style="margin: 0; color: var(--tx-2);">
      This is a large modal dialog. Use this for content that needs more horizontal space,
      like data tables or complex forms.
    </p>
  </Modal>

  <Modal bind:open={fullOpen} title="Full-width Modal" size="full">
    <p style="margin: 0; color: var(--tx-2);">
      This is a full-width modal that takes up 90% of the viewport width.
      It's useful for detailed views or when you need maximum space.
    </p>
  </Modal>
</section>

<section>
  <h3>With Form</h3>
  <Button onclick={() => { formOpen = true; }} variant="secondary">Open Form Modal</Button>

  <Modal bind:open={formOpen} title="Create New Project">
    <form style="display: flex; flex-direction: column; gap: 1rem;">
      <Input label="Project Name" placeholder="My Project" />
      <Textarea label="Description" placeholder="Describe your project..." minRows={3} />
      <Input label="Repository URL" type="url" placeholder="https://github.com/..." />
    </form>
    {#snippet footer()}
      <Button variant="ghost" onclick={() => { formOpen = false; }}>Cancel</Button>
      <Button variant="primary" onclick={() => { formOpen = false; }}>Create Project</Button>
    {/snippet}
  </Modal>
</section>

<section>
  <h3>Confirmation Pattern</h3>
  <Button onclick={() => { confirmOpen = true; }} variant="danger">Delete Item</Button>

  <Modal bind:open={confirmOpen} title="Confirm Deletion" size="sm">
    <p style="margin: 0; color: var(--tx-2);">
      Are you sure you want to delete this item? This action cannot be undone.
    </p>
    {#snippet footer()}
      <Button variant="ghost" onclick={() => { confirmOpen = false; }}>Cancel</Button>
      <Button variant="danger" onclick={() => { confirmOpen = false; }}>Delete</Button>
    {/snippet}
  </Modal>
</section>

<section>
  <h3>Scrollable Content</h3>
  <Button onclick={() => { scrollOpen = true; }} variant="secondary">Open Scrollable Modal</Button>

  <Modal bind:open={scrollOpen} title="Terms of Service" size="md">
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      {#each Array(10) as _, i}
        <div>
          <h4 style="margin: 0 0 0.5rem 0; font-family: var(--font-ui);">Section {i + 1}</h4>
          <p style="margin: 0; color: var(--tx-2);">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
            exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </p>
        </div>
      {/each}
    </div>
    {#snippet footer()}
      <Button variant="ghost" onclick={() => { scrollOpen = false; }}>Decline</Button>
      <Button variant="primary" onclick={() => { scrollOpen = false; }}>Accept</Button>
    {/snippet}
  </Modal>
</section>

<section>
  <h3>Without Close Button</h3>
  <p style="margin-bottom: 1rem; font-size: var(--font-size-sm); color: var(--tx-2);">
    Modal that cannot be closed by clicking backdrop or pressing Escape.
  </p>
  <Button onclick={() => { noCloseOpen = true; }} variant="secondary">Open Modal</Button>

  <Modal
    bind:open={noCloseOpen}
    title="Important Notice"
    size="sm"
    showCloseButton={false}
    closeOnBackdrop={false}
    closeOnEscape={false}
  >
    <p style="margin: 0; color: var(--tx-2);">
      You must acknowledge this message to continue.
    </p>
    {#snippet footer()}
      <Button variant="primary" onclick={() => { noCloseOpen = false; }}>I Understand</Button>
    {/snippet}
  </Modal>
</section>

<section>
  <h3>No Title</h3>
  <Button onclick={() => { basicOpen = true; }} variant="secondary">Open Minimal Modal</Button>
</section>
