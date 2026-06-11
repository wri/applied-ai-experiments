<script lang="ts">
	import { Tabs } from '@wri-datalab/ui';
	import PlotContainer from './PlotContainer.svelte';
	import type { SearchResult } from '../types';

	interface Props {
		rawScores: number[];
		pageResults: SearchResult[];
		threshold?: number;
	}

	let { rawScores, pageResults, threshold = 0.5 }: Props = $props();

	let mode = $state<'distribution' | 'by-page'>('distribution');
	const tabs = [
		{ id: 'distribution', label: 'Score distribution' },
		{ id: 'by-page', label: 'By page' }
	];

	// Resolve the amber primary from the prototype variant scope (CSS vars don't
	// resolve inside SVG fill attributes, so we read a concrete value).
	let rootEl: HTMLElement | undefined = $state();
	let primary = $state('oklch(0.8 0.17 85)');
	$effect(() => {
		if (rootEl) {
			const v = getComputedStyle(rootEl).getPropertyValue('--primary').trim();
			if (v) primary = v;
		}
	});

	// Per-page top (raw) match score, ordered by page.
	let pageData = $derived(
		pageResults
			.map((r) => ({ page: r.pageNumber, score: r.chunks[0]?.similarity ?? 0 }))
			.sort((a, b) => a.page - b.page)
	);

	let plotFn = $derived.by(() => {
		const fill = primary;
		if (mode === 'distribution') {
			const scores = rawScores;
			const th = threshold;
			return (Plot: any) => ({
				height: 180,
				marginLeft: 44,
				marginBottom: 38,
				x: { label: 'cosine similarity →', domain: [0, 1] },
				y: { label: '↑ chunks', grid: true },
				marks: [
					Plot.rectY(
						scores,
						Plot.binX({ y: 'count' }, { x: (d: number) => d, thresholds: 24, fill, fillOpacity: 0.75 })
					),
					Plot.ruleX([th], { stroke: 'currentColor', strokeOpacity: 0.4, strokeDasharray: '3,3' }),
					Plot.ruleY([0])
				]
			});
		}
		const data = pageData;
		return (Plot: any) => ({
			height: 180,
			marginLeft: 44,
			marginBottom: 38,
			x: { label: 'page →' },
			y: { label: '↑ top match', domain: [0, 1], grid: true },
			marks: [
				Plot.barY(data, { x: 'page', y: 'score', fill, fillOpacity: 0.8, tip: true }),
				Plot.ruleY([0])
			]
		});
	});
</script>

<div class="score-chart" bind:this={rootEl}>
	<Tabs items={tabs} active={mode} size="sm" onchange={(id) => (mode = id as typeof mode)} />
	{#if rawScores.length === 0}
		<p class="empty">Run a search to see the score distribution.</p>
	{:else}
		<PlotContainer {plotFn} />
		<p class="caption">
			{#if mode === 'distribution'}
				Histogram of raw cosine similarity across matched chunks. A spike on the right means a clear,
				confident match; a flat blob near the dashed threshold means weak relevance.
			{:else}
				Each bar is a page's best (raw) match score — taller bars are more relevant pages.
			{/if}
		</p>
	{/if}
</div>

<style>
	.score-chart {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.caption {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--tx-3);
		line-height: 1.5;
	}

	.empty {
		color: var(--tx-3);
		font-size: var(--font-size-sm);
		text-align: center;
		padding: var(--space-8) var(--space-4);
	}
</style>
