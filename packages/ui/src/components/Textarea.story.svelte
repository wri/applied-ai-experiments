<script lang="ts" module>
  export const meta = {
    title: 'Textarea',
    description: 'Multi-line text input with label, hint, error states, and resize options',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import Textarea from './Textarea.svelte';

  let message = $state('');
  let description = $state('');
  let code = $state('function hello() {\n  console.log("Hello, world!");\n}');
</script>

<section>
  <h3>Basic</h3>
  <div style="max-width: 400px;">
    <Textarea bind:value={message} placeholder="Type your message here..." />
    <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; color: var(--tx-3);">
      Characters: {message.length}
    </p>
  </div>
</section>

<section>
  <h3>With Label and Hint</h3>
  <div style="max-width: 400px; display: flex; flex-direction: column; gap: 1rem;">
    <Textarea
      label="Description"
      bind:value={description}
      placeholder="Describe your project..."
      hint="Maximum 500 characters"
    />
    <Textarea
      label="Bio"
      placeholder="Tell us about yourself"
      hint="This will be visible on your public profile"
    />
  </div>
</section>

<section>
  <h3>Error State</h3>
  <div style="max-width: 400px; display: flex; flex-direction: column; gap: 1rem;">
    <Textarea
      label="Feedback"
      value="Too short"
      error="Feedback must be at least 20 characters"
    />
    <Textarea
      label="Comment"
      value=""
      error="This field is required"
    />
  </div>
</section>

<section>
  <h3>Resize Modes</h3>
  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; max-width: 600px;">
    <Textarea
      label="Vertical only (default)"
      resize="vertical"
      placeholder="Can resize vertically..."
    />
    <Textarea
      label="Horizontal only"
      resize="horizontal"
      placeholder="Can resize horizontally..."
    />
    <Textarea
      label="Both directions"
      resize="both"
      placeholder="Can resize in both directions..."
    />
    <Textarea
      label="No resize"
      resize="none"
      placeholder="Cannot be resized..."
    />
  </div>
</section>

<section>
  <h3>Row Constraints</h3>
  <div style="max-width: 400px; display: flex; flex-direction: column; gap: 1rem;">
    <Textarea
      label="Minimum 2 rows"
      minRows={2}
      placeholder="Small textarea..."
    />
    <Textarea
      label="Minimum 5 rows"
      minRows={5}
      placeholder="Larger textarea..."
    />
    <Textarea
      label="Min 3, Max 6 rows"
      minRows={3}
      maxRows={6}
      placeholder="Constrained height..."
      hint="Content will scroll after 6 rows"
    />
  </div>
</section>

<section>
  <h3>Code Input Example</h3>
  <div style="max-width: 500px;">
    <Textarea
      label="Code Snippet"
      bind:value={code}
      minRows={6}
      resize="vertical"
      style="font-family: var(--font-mono);"
    />
  </div>
</section>

<section>
  <h3>Disabled</h3>
  <div style="max-width: 400px;">
    <Textarea
      label="Locked Content"
      value="This content cannot be modified"
      disabled
    />
  </div>
</section>
