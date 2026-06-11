<script lang="ts">
	import type { Page, SearchResult } from '../types';
	import PageThumbnail from './PageThumbnail.svelte';
	import HeatmapLegend from './HeatmapLegend.svelte';

	interface Props {
		pages: Page[];
		searchResults: SearchResult[];
		selectedPage: number | null;
		onPageSelect?: (pageNumber: number) => void;
	}

	let { pages, searchResults, selectedPage, onPageSelect }: Props = $props();

	// Normalized score (heatmap), raw cosine (tooltip), and rank, per page.
	let scoreMap = $derived(new Map(searchResults.map((r) => [r.pageNumber, r.score])));
	let rawScoreMap = $derived(
		new Map(searchResults.map((r) => [r.pageNumber, r.chunks[0]?.similarity ?? 0]))
	);
	let rankMap = $derived(new Map(searchResults.map((r, i) => [r.pageNumber, i + 1])));
	let topPages = $derived(searchResults.slice(0, 3).map((r) => r.pageNumber));
	let hasResults = $derived(searchResults.length > 0);
</script>

<div class="grid-wrap">
	{#if hasResults}
		<HeatmapLegend />
	{/if}
	<div class="thumbnail-grid">
		{#each pages as page (page.pageNumber)}
			<PageThumbnail
				pageNumber={page.pageNumber}
				thumbnail={page.thumbnail}
				score={scoreMap.get(page.pageNumber) ?? 0}
				rawScore={rawScoreMap.get(page.pageNumber)}
				rank={rankMap.get(page.pageNumber)}
				isTopResult={topPages.includes(page.pageNumber)}
				isSelected={selectedPage === page.pageNumber}
				onclick={() => onPageSelect?.(page.pageNumber)}
			/>
		{/each}
	</div>
</div>

<style>
	.grid-wrap {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.thumbnail-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-2);
	}

	@media (min-width: 480px) {
		.thumbnail-grid {
			grid-template-columns: repeat(4, 1fr);
			gap: var(--space-3);
		}
	}

	@media (min-width: 640px) {
		.thumbnail-grid {
			grid-template-columns: repeat(5, 1fr);
		}
	}

	@media (min-width: 768px) {
		.thumbnail-grid {
			grid-template-columns: repeat(6, 1fr);
		}
	}

	@media (min-width: 1024px) {
		.thumbnail-grid {
			grid-template-columns: repeat(8, 1fr);
		}
	}
</style>
