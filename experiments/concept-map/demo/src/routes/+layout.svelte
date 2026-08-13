<script lang="ts">
	import './+layout.css';
	import { onMount } from 'svelte';
	import { ToastContainer } from '@wri-datalab/ui';
	import { SessionTelemetry } from '@wri-datalab/llm-lab';
	import { initStores } from '$lib/stores';
	import { SLUG } from '$lib/slug';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	onMount(() => {
		initStores();
	});
</script>

<div data-variant="prototype">
	{@render children()}
	<ToastContainer />
	<SessionTelemetry slug={SLUG} trigger="none" />
</div>
