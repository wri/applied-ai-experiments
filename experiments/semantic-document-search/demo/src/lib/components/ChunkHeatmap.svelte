<script lang="ts">
	import type { ChunkStripItem } from '../types';

	interface Props {
		strip: ChunkStripItem[];
		onPageSelect?: (pageNumber: number) => void;
	}

	let { strip, onPageSelect }: Props = $props();

	// Normalize across all chunks so the amber ramp spans the full range and the
	// relevant regions of the document stand out against the rest.
	let bounds = $derived.by(() => {
		const s = strip.map((c) => c.similarity);
		return { min: s.length ? Math.min(...s) : 0, max: s.length ? Math.max(...s) : 1 };
	});

	function intensity(sim: number): number {
		const range = bounds.max - bounds.min;
		return range === 0 ? 1 : Math.max(0, Math.min(1, (sim - bounds.min) / range));
	}

	// Amber tint (hue 85): near-background for weak chunks, deepening for strong ones.
	function cellColor(sim: number): string {
		const t = intensity(sim);
		const lightness = 74 - t * 24;
		const chroma = 0.04 + t * 0.2;
		return `oklch(${lightness}% ${chroma} 85 / ${0.12 + t * 0.78})`;
	}
</script>

{#if strip.length === 0}
	<p class="empty">Run a search to see a per-chunk relevance map of the whole document.</p>
{:else}
	<div class="chunk-heatmap">
		<p class="caption">
			Every passage in the document, left to right in reading order — deeper amber means a stronger
			match. Click a cell to open its page.
		</p>
		<div class="strip">
			{#each strip as c, i (i)}
				<button
					type="button"
					class="cell"
					style="background-color: {cellColor(c.similarity)}"
					title={`page ${c.pageNumber} · ${Math.round(c.similarity * 100)}% match · ${c.preview}`}
					aria-label={`Chunk ${i + 1} of ${strip.length}, page ${c.pageNumber}, ${Math.round(c.similarity * 100)} percent match. ${c.preview}`}
					onclick={() => onPageSelect?.(c.pageNumber)}
				></button>
			{/each}
		</div>
		<p class="footnote">{strip.length} passages in document order.</p>
	</div>
{/if}

<style>
	.chunk-heatmap {
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

	.strip {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
	}

	.cell {
		width: 18px;
		height: 18px;
		padding: 0;
		border: 1px solid color-mix(in oklch, var(--ui) 60%, transparent);
		border-radius: 3px;
		cursor: pointer;
		transition: transform var(--transition-fast), border-color var(--transition-fast);
	}

	.cell:hover {
		border-color: var(--primary);
		transform: scale(1.3);
	}

	.footnote {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--tx-3);
	}

	.empty {
		color: var(--tx-3);
		font-size: var(--font-size-sm);
		text-align: center;
		padding: var(--space-8) var(--space-4);
	}
</style>
