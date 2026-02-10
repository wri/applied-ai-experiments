<script lang="ts">
	import { Button, Badge, Panel } from '@wri-datalab/ui';
	import type { Page, SearchResult, ChunkResult } from '../types';

	interface Props {
		page: Page;
		searchResult?: SearchResult;
		fullPageImage?: string;
		onClose?: () => void;
		onPrevious?: () => void;
		onNext?: () => void;
		hasPrevious?: boolean;
		hasNext?: boolean;
	}

	let {
		page,
		searchResult,
		fullPageImage,
		onClose,
		onPrevious,
		onNext,
		hasPrevious = false,
		hasNext = false
	}: Props = $props();

	// Sort chunks by similarity score
	let sortedChunks = $derived(
		searchResult?.chunks.slice().sort((a, b) => b.similarity - a.similarity) ?? []
	);

	function highlightText(text: string): string {
		// Simple highlight - in production could use actual query terms
		return text;
	}
</script>

<div class="page-detail">
	<div class="detail-header">
		<div class="header-left">
			<h2>Page {page.pageNumber}</h2>
			{#if searchResult}
				<Badge variant="success">
					{Math.round(searchResult.score * 100)}% match
				</Badge>
			{/if}
		</div>
		<div class="header-actions">
			<Button
				variant="ghost"
				size="sm"
				onclick={onPrevious}
				disabled={!hasPrevious}
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M15 18l-6-6 6-6" />
				</svg>
				Previous
			</Button>
			<Button
				variant="ghost"
				size="sm"
				onclick={onNext}
				disabled={!hasNext}
			>
				Next
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M9 18l6-6-6-6" />
				</svg>
			</Button>
			<Button variant="secondary" size="sm" onclick={onClose}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
				Close
			</Button>
		</div>
	</div>

	<div class="detail-content">
		<div class="page-preview">
			{#if fullPageImage}
				<img src={fullPageImage} alt="Page {page.pageNumber}" />
			{:else if page.thumbnail}
				<img src={page.thumbnail} alt="Page {page.pageNumber}" class="thumbnail-preview" />
			{:else}
				<div class="preview-placeholder">
					<span>Page {page.pageNumber}</span>
				</div>
			{/if}
		</div>

		<div class="page-passages">
			{#if sortedChunks.length > 0}
				<Panel title="Relevant Passages">
					<div class="passages-list">
						{#each sortedChunks as chunkResult, i}
							<div class="passage" class:top-passage={i < 3}>
								<div class="passage-header">
									<Badge variant={i < 3 ? 'success' : 'default'}>
										{Math.round(chunkResult.similarity * 100)}%
									</Badge>
								</div>
								<p class="passage-text">
									{@html highlightText(chunkResult.chunk.text)}
								</p>
							</div>
						{/each}
					</div>
				</Panel>
			{:else}
				<Panel title="Page Content">
					<p class="page-text-preview">
						{page.text.slice(0, 500)}{page.text.length > 500 ? '...' : ''}
					</p>
				</Panel>
			{/if}
		</div>
	</div>
</div>

<style>
	.page-detail {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		height: 100%;
	}

	.detail-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: var(--space-3);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--ui);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.header-left h2 {
		margin: 0;
		font-size: var(--font-size-xl);
	}

	.header-actions {
		display: flex;
		gap: var(--space-2);
	}

	.detail-content {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-6);
		flex: 1;
		overflow: hidden;
	}

	@media (max-width: 768px) {
		.detail-content {
			grid-template-columns: 1fr;
		}
	}

	.page-preview {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		background-color: var(--bg-2);
		border-radius: var(--radius-md);
		padding: var(--space-4);
		overflow: auto;
	}

	.page-preview img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		box-shadow: var(--shadow-md);
	}

	.thumbnail-preview {
		max-width: 300px;
	}

	.preview-placeholder {
		width: 200px;
		aspect-ratio: 8.5 / 11;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--bg);
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-2xl);
		color: var(--tx-3);
	}

	.page-passages {
		overflow: auto;
	}

	.passages-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.passage {
		padding: var(--space-3);
		background-color: var(--bg);
		border: 1px solid var(--ui);
		border-radius: var(--radius-md);
	}

	.passage.top-passage {
		border-color: var(--primary);
		background-color: color-mix(in oklch, var(--primary) 5%, var(--bg));
	}

	.passage-header {
		margin-bottom: var(--space-2);
	}

	.passage-text {
		margin: 0;
		font-size: var(--font-size-sm);
		line-height: 1.6;
		color: var(--tx);
	}

	.page-text-preview {
		font-size: var(--font-size-sm);
		line-height: 1.6;
		color: var(--tx-2);
		white-space: pre-wrap;
	}
</style>
