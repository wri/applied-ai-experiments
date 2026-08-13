<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<kbd>{@render children()}</kbd>

<style>
	kbd {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--tx-2);
		background: var(--bg-3);
		border: 1px solid var(--ui-2);
		border-bottom-width: 2px;
		border-radius: var(--radius-sm);
		padding: 0.05rem 0.3rem;
	}
</style>
