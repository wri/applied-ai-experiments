<script lang="ts">
	import { SearchInput, Spinner } from '@wri-datalab/ui';

	interface Props {
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		isSearching?: boolean;
		modelStatus?: 'idle' | 'loading' | 'ready' | 'error';
		suggestedQueries?: string[];
		onSearch?: (query: string) => void;
	}

	let {
		value = $bindable(''),
		placeholder = 'Search by meaning, not just keywords...',
		disabled = false,
		isSearching = false,
		modelStatus = 'idle',
		suggestedQueries = [],
		onSearch
	}: Props = $props();

	function runSuggested(query: string) {
		value = query;
		onSearch?.(query);
	}

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	const DEBOUNCE_MS = 300;

	function handleInput(newValue: string) {
		value = newValue;

		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		if (newValue.trim()) {
			debounceTimer = setTimeout(() => {
				onSearch?.(newValue.trim());
			}, DEBOUNCE_MS);
		}
	}

	function handleClear() {
		value = '';
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		onSearch?.('');
	}
</script>

<div class="search-bar">
	<div class="search-input-wrapper">
		<SearchInput
			{value}
			{placeholder}
			disabled={disabled || modelStatus === 'loading'}
			oninput={handleInput}
			onclear={handleClear}
		/>
		{#if isSearching || modelStatus === 'loading'}
			<div class="search-indicator">
				<Spinner size="sm" />
			</div>
		{/if}
	</div>

	{#if modelStatus === 'loading'}
		<p class="model-status">Loading embedding model...</p>
	{:else if modelStatus === 'ready' && !value && suggestedQueries.length > 0}
		<div class="suggestions">
			<span class="suggestions-label">Try:</span>
			{#each suggestedQueries as q}
				<button type="button" class="chip" onclick={() => runSuggested(q)}>{q}</button>
			{/each}
		</div>
	{:else if modelStatus === 'ready' && !value}
		<p class="search-hint">Search by meaning — relevant passages surface even with different wording.</p>
	{/if}
</div>

<style>
	.search-bar {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.search-input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-input-wrapper :global(.ui-search-input) {
		flex: 1;
	}

	.search-indicator {
		position: absolute;
		right: var(--space-10);
		display: flex;
		align-items: center;
	}

	.model-status {
		font-size: var(--font-size-sm);
		color: var(--warning);
		margin: 0;
	}

	.search-hint {
		font-size: var(--font-size-sm);
		color: var(--tx-3);
		margin: 0;
	}

	.suggestions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}

	.suggestions-label {
		font-size: var(--font-size-xs);
		color: var(--tx-3);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.chip {
		font-family: var(--font-mono);
		font-size: var(--font-size-xs);
		padding: var(--space-1) var(--space-2);
		background-color: var(--bg-2);
		color: var(--tx-2);
		border: 1px solid var(--ui);
		border-radius: var(--radius-full);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.chip:hover {
		border-color: var(--primary);
		color: var(--tx);
		background-color: var(--bg-3);
	}
</style>
