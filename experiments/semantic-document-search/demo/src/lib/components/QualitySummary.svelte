<script lang="ts">
	import { Badge } from '@wri-datalab/ui';
	import PlotContainer from './PlotContainer.svelte';
	import { getModel } from '../embeddings/models';
	import { interpretMetrics } from '../embeddings/metrics';
	import type { Device, SearchMetrics } from '../types';

	interface Props {
		metrics: SearchMetrics | null;
		modelId: string;
		backend: Device | 'unknown';
	}

	let { metrics, modelId, backend }: Props = $props();

	let model = $derived(getModel(modelId));
	let verdict = $derived(metrics ? interpretMetrics(metrics) : null);

	let rootEl: HTMLElement | undefined = $state();
	let primary = $state('oklch(0.8 0.17 85)');
	$effect(() => {
		if (rootEl) {
			const v = getComputedStyle(rootEl).getPropertyValue('--primary').trim();
			if (v) primary = v;
		}
	});

	const ms = (n: number) => `${Math.round(n)}ms`;
	const sentimentVariant = (s: 'good' | 'ok' | 'poor') =>
		s === 'good' ? 'success' : s === 'ok' ? 'warning' : 'error';

	let plotFn = $derived.by(() => {
		if (!metrics) return () => null;
		const scores = metrics.rawScores;
		const th = metrics.threshold;
		const fill = primary;
		return (Plot: any) => ({
			height: 120,
			marginLeft: 36,
			marginBottom: 30,
			x: { label: 'cosine →', domain: [0, 1] },
			y: { label: null, ticks: 3 },
			marks: [
				Plot.rectY(
					scores,
					Plot.binX({ y: 'count' }, { x: (d: number) => d, thresholds: 20, fill, fillOpacity: 0.75 })
				),
				Plot.ruleX([th], { stroke: 'currentColor', strokeOpacity: 0.4, strokeDasharray: '3,3' }),
				Plot.ruleY([0])
			]
		});
	});
</script>

<div class="quality" bind:this={rootEl}>
	{#if !metrics}
		<p class="empty">Run a search to see quality signals (match confidence, timing, distribution).</p>
	{:else}
		{#if verdict}
			<div class="verdict">
				<Badge variant={sentimentVariant(verdict.sentiment)}>verdict</Badge>
				<span>{verdict.label}</span>
			</div>
		{/if}

		<div class="metric-grid">
			<div class="tile">
				<span class="k">Top score</span>
				<span class="v">{metrics.rawTopScore.toFixed(2)}</span>
			</div>
			<div class="tile">
				<span class="k">Gap #1↔#2</span>
				<span class="v">{metrics.scoreGapTop12.toFixed(2)}</span>
			</div>
			<div class="tile">
				<span class="k">Mean top-K</span>
				<span class="v">{metrics.meanTopK.toFixed(2)}</span>
			</div>
			<div class="tile">
				<span class="k">Above {metrics.threshold}</span>
				<span class="v">{metrics.countAboveThreshold}</span>
			</div>
			<div class="tile">
				<span class="k">Query embed</span>
				<span class="v">{ms(metrics.queryEmbedMs)}</span>
			</div>
			<div class="tile">
				<span class="k">Search</span>
				<span class="v">{ms(metrics.searchMs)}</span>
			</div>
			<div class="tile">
				<span class="k">Chunks</span>
				<span class="v">{metrics.chunkCount}</span>
			</div>
			<div class="tile">
				<span class="k">Model</span>
				<span class="v small">{model.label} · {metrics.dims}d</span>
			</div>
			<div class="tile">
				<span class="k">Backend</span>
				<span class="v">
					{#if backend === 'webgpu'}
						<Badge variant="success">WebGPU</Badge>
					{:else if backend === 'wasm'}
						<Badge variant="warning">WASM (CPU)</Badge>
					{:else}
						<Badge variant="default">—</Badge>
					{/if}
				</span>
			</div>
		</div>

		<div class="histogram">
			<PlotContainer {plotFn} />
		</div>
		<p class="hint">
			Scores are raw cosine similarity (−1 to 1). A high top score with a clear gap to #2 means a
			confident, distinctive match.
		</p>
	{/if}
</div>

<style>
	.quality {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.verdict {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--font-size-sm);
		color: var(--tx);
	}

	.metric-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
		gap: var(--space-2);
	}

	.tile {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--space-2);
		background-color: var(--bg);
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
	}

	.k {
		font-size: var(--font-size-xs);
		color: var(--tx-3);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.v {
		font-family: var(--font-mono);
		font-size: var(--font-size-md);
		color: var(--tx);
	}

	.v.small {
		font-size: var(--font-size-xs);
	}

	.histogram {
		margin-top: var(--space-1);
	}

	.hint,
	.empty {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--tx-3);
		line-height: 1.5;
	}

	.empty {
		text-align: center;
		padding: var(--space-4);
	}
</style>
