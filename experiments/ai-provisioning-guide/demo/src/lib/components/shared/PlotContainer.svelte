<script lang="ts">
	import { browser } from '$app/environment';

	interface Props {
		/** A function that receives the Plot module and returns a spec for Plot.plot() */
		plotFn: (Plot: any) => any;
		class?: string;
	}

	let { plotFn, class: className = '' }: Props = $props();

	let containerEl: HTMLDivElement | undefined = $state();
	let PlotModule: any = $state(null);

	// Load the Plot module once
	$effect(() => {
		if (!browser) return;
		import('@observablehq/plot').then((mod) => {
			PlotModule = mod;
		});
	});

	// Re-render synchronously whenever plotFn or PlotModule changes.
	// Because plotFn is produced by $derived.by() in the parent, Svelte gives
	// us a new function reference each time the underlying data changes.
	$effect(() => {
		if (!containerEl || !PlotModule || !plotFn) return;
		const spec = plotFn(PlotModule);
		if (!spec) return;
		const svg = PlotModule.plot(spec);
		containerEl.replaceChildren(svg);
	});
</script>

<div class="plot-container {className}" bind:this={containerEl}>
	<div class="plot-loading">Loading chart...</div>
</div>

<style>
	.plot-container {
		width: 100%;
		overflow-x: auto;
	}

	.plot-container :global(svg) {
		width: 100%;
		height: auto;
		--plot-background: var(--bg-2);
	}

	/* Style the Observable Plot tip */
	.plot-container :global([aria-label="tip"]) {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
	}

	.plot-loading {
		padding: 2rem;
		text-align: center;
		color: var(--tx-3);
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}
</style>
