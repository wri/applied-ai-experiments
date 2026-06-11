<script lang="ts">
	import { Button, Input, Tabs, ComparisonTable } from '@wri-datalab/ui';
	import ConfigPicker from './ConfigPicker.svelte';
	import ThumbnailGrid from './ThumbnailGrid.svelte';
	import { variantLabel, type ComparisonState } from '../stores/comparison';
	import { isBm25, modelDisplayLabel } from '../embeddings/bm25';
	import type { ChunkOptions, ChunkStrategyId, Page } from '../types';

	interface Props {
		comparison: ComparisonState;
		pages: Page[];
		disabled?: boolean;
		onQueryChange?: (query: string) => void;
		onRun?: () => void;
		onVariantModelChange?: (id: string, modelId: string) => void;
		onVariantChunkingChange?: (id: string, strategyId: ChunkStrategyId, options: ChunkOptions) => void;
		onAddVariant?: () => void;
		onRemoveVariant?: (id: string) => void;
	}

	let {
		comparison,
		pages,
		disabled = false,
		onQueryChange,
		onRun,
		onVariantModelChange,
		onVariantChunkingChange,
		onAddVariant,
		onRemoveVariant
	}: Props = $props();

	let mode = $state<'metrics' | 'heatmaps'>('metrics');
	const tabs = [
		{ id: 'metrics', label: 'Metrics' },
		{ id: 'heatmaps', label: 'Heatmaps' }
	];

	let columns = $derived(
		comparison.variants.map((v) => ({ id: v.id, label: variantLabel(v, modelDisplayLabel(v.modelId)) }))
	);

	let anyResults = $derived(comparison.variants.some((v) => v.metrics));

	// When lexical (BM25) and semantic variants are mixed, raw score magnitudes
	// live on different scales — don't crown a "winner" on those rows.
	let mixedMethods = $derived(
		comparison.variants.some((v) => isBm25(v.modelId)) &&
			comparison.variants.some((v) => !isBm25(v.modelId))
	);

	function buildRow(
		label: string,
		get: (vId: string) => number | undefined,
		fmt: (x: number) => string,
		higherBetter: boolean | null,
		crossComparable: boolean = true
	) {
		const values: Record<string, string | number | boolean> = {};
		const present: number[] = [];
		for (const v of comparison.variants) {
			const val = get(v.id);
			values[v.id] = val ?? NaN;
			if (val !== undefined && !Number.isNaN(val)) present.push(val);
		}
		const best =
			higherBetter === null || present.length < 2
				? null
				: higherBetter
					? Math.max(...present)
					: Math.min(...present);
		const suppressSentiment = mixedMethods && !crossComparable;
		return {
			label,
			values,
			format: (val: number) => (val === undefined || Number.isNaN(val) ? '—' : fmt(val)),
			sentiment: (val: number) =>
				best !== null && val === best && !suppressSentiment
					? ('positive' as const)
					: ('neutral' as const)
		};
	}

	function metricOf(vId: string) {
		return comparison.variants.find((v) => v.id === vId);
	}

	// Score-magnitude rows aren't comparable across methods (cosine vs BM25);
	// timing/chunk rows are.
	let rows = $derived([
		buildRow('Top score', (id) => metricOf(id)?.metrics?.rawTopScore, (x) => x.toFixed(2), true, false),
		buildRow('Gap #1↔#2', (id) => metricOf(id)?.metrics?.scoreGapTop12, (x) => x.toFixed(2), true, false),
		buildRow('Mean top-K', (id) => metricOf(id)?.metrics?.meanTopK, (x) => x.toFixed(2), true, false),
		buildRow(
			'Matches > threshold',
			(id) => metricOf(id)?.metrics?.countAboveThreshold,
			(x) => String(x),
			true,
			false
		),
		buildRow(
			'Chunks',
			(id) => metricOf(id)?.buildMetrics?.chunkCount ?? metricOf(id)?.metrics?.chunkCount,
			(x) => String(x),
			null
		),
		buildRow(
			'Build time',
			(id) => metricOf(id)?.buildMetrics?.embedMs,
			(x) => `${Math.round(x)}ms`,
			false
		),
		buildRow(
			'Query time',
			(id) => {
				const m = metricOf(id)?.metrics;
				return m ? m.queryEmbedMs + m.searchMs : undefined;
			},
			(x) => `${Math.round(x)}ms`,
			false
		)
	]);

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') onRun?.();
	}
</script>

<div class="comparison">
	<p class="intro">
		Run the <strong>same query</strong> against the same document under different methods — embedding
		models, chunking strategies, or the <strong>BM25 keyword baseline</strong> — to see which surfaces
		the best matches. (B defaults to BM25 so you can compare semantic vs. keyword search head-to-head.)
	</p>

	<div class="variants">
		{#each comparison.variants as v (v.id)}
			<ConfigPicker
				variant={v}
				removable={comparison.variants.length > 2}
				disabled={disabled || comparison.searching}
				onModelChange={(modelId) => onVariantModelChange?.(v.id, modelId)}
				onChunkingChange={(strategyId, opts) => onVariantChunkingChange?.(v.id, strategyId, opts)}
				onRemove={() => onRemoveVariant?.(v.id)}
			/>
		{/each}
	</div>

	{#if comparison.variants.length < 4}
		<div>
			<Button variant="ghost" size="sm" disabled={disabled || comparison.searching} onclick={onAddVariant}>
				+ Add configuration
			</Button>
		</div>
	{/if}

	<div class="run-row">
		<div class="run-input">
			<Input
				value={comparison.query}
				placeholder="Query to run against every configuration..."
				disabled={disabled || comparison.searching}
				oninput={(e: Event) => onQueryChange?.((e.target as HTMLInputElement).value)}
				onkeydown={handleKeydown}
			/>
		</div>
		<Button
			variant="primary"
			disabled={disabled || comparison.searching || !comparison.query.trim()}
			onclick={onRun}
		>
			{comparison.searching ? 'Running…' : 'Run comparison'}
		</Button>
	</div>

	{#if anyResults}
		<Tabs items={tabs} active={mode} size="sm" onchange={(id) => (mode = id as typeof mode)} />
		{#if mode === 'metrics'}
			<ComparisonTable {columns} {rows} title="Search quality by configuration" />
			{#if mixedMethods}
				<p class="note">
					BM25 is keyword-based — its relevance scores are on a different scale than cosine
					similarity, so score-magnitude rows are left unhighlighted. Compare which pages each method
					surfaces (Heatmaps) for the fair, apples-to-apples view.
				</p>
			{/if}
		{:else}
			<div class="heatmaps" style="grid-template-columns: repeat({comparison.variants.length}, 1fr);">
				{#each comparison.variants as v (v.id)}
					<div class="heatmap-col">
						<span class="col-label">{variantLabel(v, modelDisplayLabel(v.modelId))}</span>
						<ThumbnailGrid
							{pages}
							searchResults={v.results ?? []}
							selectedPage={null}
						/>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.comparison {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.intro {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--tx-2);
		line-height: 1.6;
	}

	.note {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--tx-3);
		line-height: 1.5;
	}

	.variants {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.run-row {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
	}

	.run-input {
		flex: 1;
	}

	.heatmaps {
		display: grid;
		gap: var(--space-4);
	}

	.heatmap-col {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}

	.col-label {
		font-family: var(--font-mono);
		font-size: var(--font-size-xs);
		color: var(--tx-2);
	}

	@media (max-width: 768px) {
		.heatmaps {
			grid-template-columns: 1fr !important;
		}

		.run-row {
			flex-direction: column;
		}
	}
</style>
