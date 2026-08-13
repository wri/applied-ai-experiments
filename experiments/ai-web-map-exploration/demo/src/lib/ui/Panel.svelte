<script lang="ts">
	// Thin adapter over @wri-datalab/ui's Panel: preserves this app's `padded`
	// prop (the shared Panel always pads its body) by neutralizing body padding
	// via a scoped-global class when padded={false}. Forwards title + the header
	// `actions` snippet. Same adapter pattern as $lib/llm and the Badge wrapper.
	import { Panel as UiPanel } from '@wri-datalab/ui';
	import type { Snippet } from 'svelte';

	let {
		title,
		padded = true,
		actions,
		children
	}: { title?: string; padded?: boolean; actions?: Snippet; children: Snippet } = $props();
</script>

<UiPanel {title} {actions} class={padded ? '' : 'awme-unpadded'}>
	{@render children()}
</UiPanel>

<style>
	/* Reach into the shared Panel's body to drop its padding when padded={false}. */
	:global(.ui-panel.awme-unpadded .panel-body) {
		padding: 0;
	}
</style>
