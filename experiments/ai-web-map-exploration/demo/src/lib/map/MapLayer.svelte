<script lang="ts">
	import type { FilterSpecification, LayerSpecification } from 'maplibre-gl';
	import { mapStore } from './MapStore.svelte';

	interface Props {
		/** Full layer spec; id + source must be set. Only added once (not reactive). */
		spec: LayerSpecification;
		beforeId?: string;
		/** Reactive overrides, diffed after add */
		paint?: Record<string, unknown>;
		layout?: Record<string, unknown>;
		filter?: FilterSpecification | null;
	}

	let { spec, beforeId, paint, layout, filter }: Props = $props();

	let added = $state(false);

	$effect(() => {
		let cancelled = false;
		mapStore.whenReady().then(() => {
			if (cancelled) return;
			mapStore.scene.addLayer(spec, beforeId);
			added = true;
			mapStore.bumpScene();
		});
		return () => {
			cancelled = true;
			if (added) {
				mapStore.scene.removeLayer(spec.id);
				mapStore.bumpScene();
				added = false;
			}
		};
	});

	$effect(() => {
		if (!added || !paint) return;
		for (const [k, v] of Object.entries(paint)) mapStore.scene.setPaint(spec.id, k, v);
	});

	$effect(() => {
		if (!added || !layout) return;
		for (const [k, v] of Object.entries(layout)) mapStore.scene.setLayout(spec.id, k, v);
	});

	$effect(() => {
		if (!added || filter === undefined) return;
		mapStore.scene.setFilter(spec.id, filter);
	});
</script>
