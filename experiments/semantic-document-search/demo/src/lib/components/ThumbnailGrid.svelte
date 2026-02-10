<script lang="ts">
	import type { Page, SearchResult } from '../types';
	import PageThumbnail from './PageThumbnail.svelte';

	interface Props {
		pages: Page[];
		searchResults: SearchResult[];
		selectedPage: number | null;
		onPageSelect?: (pageNumber: number) => void;
	}

	let {
		pages,
		searchResults,
		selectedPage,
		onPageSelect
	}: Props = $props();

	// Create a map of page scores for quick lookup
	let scoreMap = $derived(
		new Map(searchResults.map((r) => [r.pageNumber, r.score]))
	);

	// Get top 3 page numbers
	let topPages = $derived(
		searchResults.slice(0, 3).map((r) => r.pageNumber)
	);

	function getPageScore(pageNumber: number): number {
		return scoreMap.get(pageNumber) ?? 0;
	}

	function isTopResult(pageNumber: number): boolean {
		return topPages.includes(pageNumber);
	}
</script>

<div class="thumbnail-grid">
	{#each pages as page (page.pageNumber)}
		<PageThumbnail
			pageNumber={page.pageNumber}
			thumbnail={page.thumbnail}
			score={getPageScore(page.pageNumber)}
			isTopResult={isTopResult(page.pageNumber)}
			isSelected={selectedPage === page.pageNumber}
			onclick={() => onPageSelect?.(page.pageNumber)}
		/>
	{/each}
</div>

<style>
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
