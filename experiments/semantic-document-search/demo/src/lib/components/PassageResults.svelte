<script lang="ts">
	import PassageItem from './PassageItem.svelte';
	import type { ChunkResult } from '../types';

	interface Props {
		chunkResults: ChunkResult[];
		query?: string;
		onPageSelect?: (pageNumber: number) => void;
	}

	let { chunkResults, query = '', onPageSelect }: Props = $props();
</script>

{#if chunkResults.length === 0}
	<p class="empty">Enter a query to see the most relevant passages, ranked.</p>
{:else}
	<div class="passage-list">
		{#each chunkResults as r, i (r.chunk.id + ':' + i)}
			<PassageItem
				text={r.chunk.text}
				similarity={r.similarity}
				highlight={i < 3}
				{query}
				pageNumber={r.chunk.pageNumber}
				{onPageSelect}
			/>
		{/each}
	</div>
{/if}

<style>
	.passage-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.empty {
		color: var(--tx-3);
		font-size: var(--font-size-sm);
		text-align: center;
		padding: var(--space-8) var(--space-4);
	}
</style>
