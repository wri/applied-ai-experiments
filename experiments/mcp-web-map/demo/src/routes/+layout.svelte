<script lang="ts">
  import { onMount } from 'svelte';
  import './+layout.css';
  import { ToastContainer } from '@wri-datalab/ui';

  let { children } = $props();
</script>

<div class="app-root" data-variant="prototype">
  {@render children()}
  <ToastContainer />
</div>
