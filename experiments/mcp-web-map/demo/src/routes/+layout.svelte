<script lang="ts">
  import './+layout.css';
  import { ToastContainer } from '@wri-datalab/ui';
  import { SessionTelemetry } from '@wri-datalab/llm-lab';
  import { SLUG } from '$lib/slug';

  let { children } = $props();
</script>

<div class="app-root" data-variant="prototype">
  {@render children()}
  <ToastContainer />
  <!-- trigger="none": the dashboard opens from <SessionTelemetryTrigger /> in
       the page's headerActions, not a floating FAB (the demo standard). -->
  <SessionTelemetry slug={SLUG} trigger="none" />
</div>
