<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		side?: 'left' | 'right';
		width?: string;
		/** stretch to full height of the map area */
		fill?: boolean;
		children: Snippet;
	}

	let { side = 'left', width = '23rem', fill = false, children }: Props = $props();
</script>

<div class="overlay {side}" class:fill style="width: min({width}, calc(100% - 2rem))">
	{@render children()}
</div>

<style>
	.overlay {
		position: absolute;
		top: var(--space-4);
		z-index: 20;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		max-height: calc(100% - 2rem);
		overflow-y: auto;
		pointer-events: none;
	}
	.overlay.fill {
		bottom: var(--space-4);
	}
	/* `flex: none` matters: as flex items the panels default to flex-shrink: 1, so
	   tall content squashed them to fit the max-height instead of overflowing it.
	   The column then never overflowed, so `overflow-y: auto` above never engaged
	   and the clipped panel bodies (.ui-panel is overflow: hidden) had no way to
	   scroll. Refusing to shrink hands the overflow to the scroll container. */
	.overlay > :global(*) {
		flex: none;
		pointer-events: auto;
	}
	.left {
		left: var(--space-4);
	}
	.right {
		right: var(--space-4);
	}
</style>
