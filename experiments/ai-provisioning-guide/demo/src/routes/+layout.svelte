<script lang="ts">
	import '@wri-datalab/ui/styles';
	import './+layout.css';
	import { ToastContainer } from '@wri-datalab/ui';

	let { children } = $props();

	// Pre-paint theme bootstrap lives in app.html (shared "prototype-theme" key).
</script>

<div data-variant="prototype">
	{@render children()}
	<ToastContainer />
</div>
