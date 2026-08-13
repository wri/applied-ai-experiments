<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { demos } from '$lib/demos/registry';
	import { onMount } from 'svelte';

	onMount(() => {
		goto(`${base}/${demos[0].slug}`, { replaceState: true });
	});
</script>
