<script lang="ts">
	import { Button } from '@wri-datalab/ui';
	import { appStore } from '$lib/stores/app.svelte.js';
	import { methods } from '$lib/data/methods.js';
	import MethodCard from './MethodCard.svelte';

	const viableResults = $derived(
		appStore.sortedMethods.map((id) => ({
			method: methods.find((m) => m.id === id)!,
			viability: appStore.viabilityMap.get(id)!,
		})),
	);

	const viableCount = $derived(
		viableResults.filter((r) => r.viability.viability === 'viable').length,
	);
	const cautionCount = $derived(
		viableResults.filter((r) => r.viability.viability === 'caution').length,
	);
	const eliminatedCount = $derived(
		viableResults.filter((r) => r.viability.viability === 'eliminated').length,
	);

	function goToCalculator() {
		// Pre-select viable methods for TCO comparison
		const viable = viableResults
			.filter((r) => r.viability.viability !== 'eliminated')
			.map((r) => r.method.id);
		appStore.setSelectedMethods(viable.slice(0, 4));
		appStore.setTab('calculator');
	}

	function goToCompare() {
		const viable = viableResults
			.filter((r) => r.viability.viability !== 'eliminated')
			.map((r) => r.method.id);
		appStore.setSelectedMethods(viable.slice(0, 4));
		appStore.setTab('compare');
	}
</script>

<div class="results-summary">
	<div class="results-header">
		<h2>Results</h2>
		<p class="results-stats">
			{viableCount} viable · {cautionCount} caution · {eliminatedCount} eliminated
		</p>
	</div>

	<div class="results-grid">
		{#each viableResults as { method, viability }}
			<MethodCard {method} {viability} />
		{/each}
	</div>

	<div class="results-actions">
		<Button variant="primary" onclick={goToCalculator}>
			Estimate costs
		</Button>
		<Button variant="secondary" onclick={goToCompare}>
			Compare methods
		</Button>
		<Button variant="ghost" onclick={() => appStore.reset()}>
			Start over
		</Button>
	</div>
</div>

<style>
	.results-summary {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.results-header h2 {
		font-size: 1rem;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tx);
		margin: 0;
	}

	.results-stats {
		font-size: 0.8125rem;
		color: var(--tx-2);
		margin: 0.25rem 0 0;
	}

	.results-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 0.75rem;
	}

	.results-actions {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	@media (max-width: 640px) {
		.results-grid {
			grid-template-columns: 1fr;
		}

		.results-actions {
			flex-direction: column;
		}
	}
</style>
