<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { getDemo, loadDemo } from '$lib/demos/registry';
	import Panel from '$lib/ui/Panel.svelte';
	import Spinner from '$lib/ui/Spinner.svelte';

	import { mapStore } from '$lib/map/MapStore.svelte';

	const slug = $derived(page.params.demo ?? '');
	const demo = $derived(getDemo(slug));

	// Demo activation: sweep the previous demo's scene, then apply this demo's
	// map config (or hide the map entirely).
	$effect(() => {
		const d = demo;
		mapStore.resetScene();
		if (!d || d.map === null) {
			mapStore.visible = false;
			return;
		}
		mapStore.visible = true;
		mapStore.setBasemap(d.map.basemap);
		mapStore.easeTo(d.map.camera, 600);
	});
</script>

{#if !demo}
	<div class="center">
		<Panel title="Not found">
			<p>No demo named <code>{slug}</code>. Pick one from the left panel.</p>
			<a href="{base}/">Back to start</a>
		</Panel>
	</div>
{:else}
	{#key demo.slug}
		{#await loadDemo(demo.slug)}
			<div class="center"><Spinner size={20} /></div>
		{:then DemoComponent}
			<DemoComponent />
		{:catch err}
			<div class="center">
				<Panel title="Failed to load demo">
					<p>{err.message}</p>
				</Panel>
			</div>
		{/await}
	{/key}
{/if}

<style>
	.center {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10;
	}
	code {
		font-family: var(--font-mono);
		color: var(--warning-text);
	}
	p {
		margin: 0 0 var(--space-2);
	}
	a {
		color: var(--primary);
		font-family: var(--font-mono);
		font-size: var(--text-ui);
	}
</style>
