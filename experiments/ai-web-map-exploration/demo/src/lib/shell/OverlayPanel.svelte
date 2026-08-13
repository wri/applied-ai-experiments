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
	.overlay > :global(*) {
		pointer-events: auto;
	}
	.left {
		left: var(--space-4);
	}
	.right {
		right: var(--space-4);
	}
</style>
