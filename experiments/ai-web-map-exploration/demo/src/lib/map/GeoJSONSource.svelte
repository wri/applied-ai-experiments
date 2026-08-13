<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { mapStore } from './MapStore.svelte';

	interface Props {
		id: string;
		/** GeoJSON object or a URL string */
		data: GeoJSON.GeoJSON | string;
		promoteId?: string;
		children?: Snippet;
	}

	let { id, data, promoteId, children }: Props = $props();

	let added = $state(false);

	$effect(() => {
		let cancelled = false;
		mapStore.whenReady().then(() => {
			if (cancelled) return;
			untrack(() => {
				mapStore.scene.addSource(id, { type: 'geojson', data, promoteId });
				added = true;
				mapStore.bumpScene();
			});
		});
		return () => {
			cancelled = true;
			if (untrack(() => added)) {
				mapStore.scene.removeSource(id);
				added = false;
			}
		};
	});

	// Reactive data updates after the initial add (object data only)
	$effect(() => {
		const d = data;
		if (added && typeof d !== 'string') mapStore.scene.setData(id, d);
	});
</script>

{#if added}
	{@render children?.()}
{/if}
