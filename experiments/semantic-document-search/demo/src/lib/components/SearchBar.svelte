<script lang="ts">
	import { SearchInput, Spinner } from '@wri-datalab/ui';

	interface Props {
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		isSearching?: boolean;
		modelStatus?: 'idle' | 'loading' | 'ready' | 'error';
		onSearch?: (query: string) => void;
	}

	let {
		value = $bindable(''),
		placeholder = 'Search by meaning, not just keywords...',
		disabled = false,
		isSearching = false,
		modelStatus = 'idle',
		onSearch
	}: Props = $props();

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
	{:else if modelStatus === 'ready' && !value}
		<p class="search-hint">
			Try semantic queries like "funding mechanisms" or "environmental impact"
		</p>
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
</style>
