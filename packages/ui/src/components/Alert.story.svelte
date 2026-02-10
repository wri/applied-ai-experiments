<script lang="ts" module>
  export const meta = {
    title: 'Alert',
    description: 'Alert messages with different severity levels',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import Alert from './Alert.svelte';
</script>

<section>
  <h3>Variants</h3>
  <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 500px;">
    <Alert variant="info">
      This is an informational message.
    </Alert>
    <Alert variant="success">
      Operation completed successfully.
    </Alert>
    <Alert variant="warning">
      Please review the settings before continuing.
    </Alert>
    <Alert variant="error">
      An error occurred while processing your request.
    </Alert>
  </div>
</section>

<section>
  <h3>With Title</h3>
  <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 500px;">
    <Alert variant="info">
      {#snippet title()}System Update{/snippet}
      A new version is available. Please refresh to update.
    </Alert>
    <Alert variant="success">
      {#snippet title()}Payment Received{/snippet}
      Your payment of $49.99 has been processed.
    </Alert>
    <Alert variant="error">
      {#snippet title()}Connection Failed{/snippet}
      Unable to connect to the server. Check your network settings.
    </Alert>
  </div>
</section>

<section>
  <h3>Dismissible</h3>
  <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 500px;">
    <Alert variant="info" dismissible ondismiss={() => console.log('Dismissed!')}>
      This alert can be dismissed by clicking the X button.
    </Alert>
    <Alert variant="warning" dismissible>
      {#snippet title()}Review Required{/snippet}
      Your submission needs review. Click X to dismiss this notice.
    </Alert>
  </div>
</section>
