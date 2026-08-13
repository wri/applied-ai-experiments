<script lang="ts">
	import { Badge } from '@wri-datalab/ui';

	interface Props {
		text: string;
		similarity: number; // raw cosine
		highlight?: boolean; // top-result styling
		query?: string;
		pageNumber?: number;
		onPageSelect?: (pageNumber: number) => void;
	}

	let { text, similarity, highlight = false, query = '', pageNumber, onPageSelect }: Props = $props();

	let pct = $derived(Math.round(Math.max(0, similarity) * 100));

	function escapeHtml(s: string): string {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	// XSS-safe: escape the text first, then wrap query tokens in <mark>. The only
	// HTML introduced is our own <mark> tags.
	function highlightTokens(raw: string, q: string): string {
		const escaped = escapeHtml(raw);
		const tokens = q
			.trim()
			.split(/\s+/)
			.filter((t) => t.length >= 3)
			.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
		if (tokens.length === 0) return escaped;
		const re = new RegExp(`(${tokens.join('|')})`, 'gi');
		return escaped.replace(re, '<mark>$1</mark>');
	}

	let html = $derived(highlightTokens(text, query));
</script>

<div class="passage" class:top={highlight}>
	<div class="passage-header">
		<Badge variant={highlight ? 'success' : 'default'}>{pct}%</Badge>
		{#if pageNumber !== undefined && onPageSelect}
			<button type="button" class="page-link" onclick={() => onPageSelect?.(pageNumber!)}>
				page {pageNumber}
			</button>
		{/if}
	</div>
	<p class="passage-text">{@html html}</p>
</div>

<style>
	.passage {
		padding: var(--space-3);
		background-color: var(--bg);
		border: 1px solid var(--ui);
		border-radius: var(--radius-md);
	}

	.passage.top {
		border-color: var(--primary);
		background-color: color-mix(in oklch, var(--primary) 5%, var(--bg));
	}

	.passage-header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}

	.page-link {
		font-family: var(--font-mono);
		font-size: var(--font-size-xs);
		color: var(--tx-3);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
	}

	.page-link:hover {
		color: var(--primary);
		text-decoration: underline;
	}

	.passage-text {
		margin: 0;
		font-size: var(--font-size-sm);
		line-height: 1.6;
		color: var(--tx);
	}

	.passage-text :global(mark) {
		background-color: color-mix(in oklch, var(--primary) 35%, transparent);
		color: var(--tx);
		border-radius: 2px;
		padding: 0 1px;
	}
</style>
