<script lang="ts">
	import { Badge } from '@wri-datalab/ui';

	interface Props {
		pageNumber: number;
		thumbnail?: string;
		score?: number;
		isTopResult?: boolean;
		isSelected?: boolean;
		onclick?: () => void;
	}

	let {
		pageNumber,
		thumbnail,
		score = 0,
		isTopResult = false,
		isSelected = false,
		onclick
	}: Props = $props();

	// Heatmap color: transparent (low) -> muted teal -> vibrant teal (high)
	function getHeatmapColor(score: number): string {
		if (score === 0) return 'transparent';
		// Use oklch for perceptually uniform color blending
		const lightness = 70 - score * 20; // 70% -> 50%
		const chroma = 0.1 + score * 0.15; // 0.1 -> 0.25
		return `oklch(${lightness}% ${chroma} 180 / ${0.2 + score * 0.4})`;
	}

	let heatmapColor = $derived(getHeatmapColor(score));
</script>

<button
	class="page-thumbnail"
	class:has-score={score > 0}
	class:top-result={isTopResult}
	class:selected={isSelected}
	{onclick}
	type="button"
>
	<div class="thumbnail-container">
		{#if thumbnail}
			<img src={thumbnail} alt="Page {pageNumber}" class="thumbnail-image" />
		{:else}
			<div class="thumbnail-placeholder">
				<span>{pageNumber}</span>
			</div>
		{/if}

		{#if score > 0}
			<div class="heatmap-overlay" style="background-color: {heatmapColor}"></div>
		{/if}
	</div>

	<div class="thumbnail-footer">
		<span class="page-number">{pageNumber}</span>
		{#if score > 0}
			<Badge variant={isTopResult ? 'success' : 'default'}>
				{Math.round(score * 100)}%
			</Badge>
		{/if}
	</div>
</button>

<style>
	.page-thumbnail {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-1);
		background-color: var(--bg-2);
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.page-thumbnail:hover {
		border-color: var(--primary);
		background-color: var(--bg-3);
	}

	.page-thumbnail.selected {
		border-color: var(--primary);
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--primary) 30%, transparent);
	}

	.page-thumbnail.top-result {
		animation: subtle-pulse 2s ease-in-out infinite;
	}

	@keyframes subtle-pulse {
		0%, 100% {
			box-shadow: 0 0 0 0 color-mix(in oklch, var(--primary) 30%, transparent);
		}
		50% {
			box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 20%, transparent);
		}
	}

	.thumbnail-container {
		position: relative;
		aspect-ratio: 8.5 / 11;
		overflow: hidden;
		border-radius: var(--radius-sm);
		background-color: var(--bg);
	}

	.thumbnail-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.thumbnail-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-bold);
		color: var(--tx-3);
	}

	.heatmap-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		transition: background-color var(--transition-fast);
	}

	.thumbnail-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-1);
		min-height: 0;
	}

	.page-number {
		font-size: 10px;
		color: var(--tx-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
