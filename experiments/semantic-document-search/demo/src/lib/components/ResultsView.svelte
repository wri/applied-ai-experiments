<script lang="ts">
	import { Tabs } from '@wri-datalab/ui';
	import ThumbnailGrid from './ThumbnailGrid.svelte';
	import PassageResults from './PassageResults.svelte';
	import ChunkHeatmap from './ChunkHeatmap.svelte';
	import ScoreChart from './ScoreChart.svelte';
	import type { Page, SearchResult, ChunkResult, ChunkStripItem } from '../types';

	interface Props {
		pages: Page[];
		results: SearchResult[];
		rawChunkResults: ChunkResult[];
		chunkStrip: ChunkStripItem[];
		query?: string;
		threshold?: number;
		selectedPage: number | null;
		dimmed?: boolean;
		onPageSelect?: (pageNumber: number) => void;
	}

	let {
		pages,
		results,
		rawChunkResults,
		chunkStrip,
		query = '',
		threshold = 0.5,
		selectedPage,
		dimmed = false,
		onPageSelect
	}: Props = $props();

	let mode = $state<'heatmap' | 'chunks' | 'passages' | 'chart'>('heatmap');
	const tabs = [
		{ id: 'heatmap', label: 'Page heatmap' },
		{ id: 'chunks', label: 'Chunk heatmap' },
		{ id: 'passages', label: 'Passages' },
		{ id: 'chart', label: 'Chart' }
	];

	let rawScores = $derived(rawChunkResults.map((r) => r.similarity));
</script>

<div class="results-view">
	<Tabs items={tabs} active={mode} onchange={(id) => (mode = id as typeof mode)} />
	<div class="view" class:dimmed>
		{#if mode === 'heatmap'}
			<ThumbnailGrid {pages} searchResults={results} {selectedPage} {onPageSelect} />
		{:else if mode === 'chunks'}
			<ChunkHeatmap strip={chunkStrip} {onPageSelect} />
		{:else if mode === 'passages'}
			<PassageResults chunkResults={rawChunkResults} {query} {onPageSelect} />
		{:else}
			<ScoreChart {rawScores} pageResults={results} {threshold} />
		{/if}
	</div>
</div>

<style>
	.results-view {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.view.dimmed {
		opacity: 0.5;
		pointer-events: none;
		transition: opacity var(--transition-fast);
	}
</style>
