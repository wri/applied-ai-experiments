<script lang="ts">
	import { ComparisonTable } from '@wri-datalab/ui';
	import { appStore } from '$lib/stores/app.svelte.js';
	import { methods } from '$lib/data/methods.js';
	import { comparisonDimensions } from '$lib/data/comparisons.js';
	import type { MethodId, DeliveryMethod } from '$lib/types.js';

	function toggle(id: MethodId) {
		appStore.toggleComparison(id);
	}

	// Build columns from selected methods
	const columns = $derived(
		appStore.selectedMethods.map((id) => {
			const method = methods.find((m) => m.id === id)!;
			return {
				id: method.id,
				label: method.shortName,
				highlight: false,
			};
		}),
	);

	// Group dimensions by category
	const categories = $derived(() => {
		const cats = new Map<string, typeof comparisonDimensions>();
		for (const dim of comparisonDimensions) {
			if (!cats.has(dim.category)) cats.set(dim.category, []);
			cats.get(dim.category)!.push(dim);
		}
		return cats;
	});

	// Build rows from comparison dimensions
	const rows = $derived(
		comparisonDimensions.map((dim) => {
			const values: Record<string, string | number | boolean> = {};
			for (const id of appStore.selectedMethods) {
				const method = methods.find((m) => m.id === id)!;
				values[id] = dim.getValue(method);
			}
			return {
				label: dim.label,
				values,
				format: dim.format
					? (value: any, colId: string) => {
							const method = methods.find((m) => m.id === colId);
							return dim.format!(value, colId, method);
						}
					: undefined,
				sentiment: dim.sentiment
					? (value: any) => dim.sentiment!(value)
					: undefined,
			};
		}),
	);
</script>

<div class="compare-view">
	<!-- Method toggles -->
	<div class="method-toggles">
		<span class="toggles-label">Select methods to compare:</span>
		{#each methods as method}
			{@const isSelected = appStore.selectedMethods.includes(method.id)}
			<button
				class="method-toggle"
				class:selected={isSelected}
				onclick={() => toggle(method.id)}
			>
				{method.shortName}
			</button>
		{/each}
	</div>

	{#if appStore.selectedMethods.length === 0}
		<div class="empty-state">
			<p>Select at least two methods to compare.</p>
		</div>
	{:else if appStore.selectedMethods.length === 1}
		<div class="empty-state">
			<p>Select at least one more method for side-by-side comparison.</p>
		</div>
	{:else}
		<div class="table-scroll-wrapper">
			<ComparisonTable
				{columns}
				{rows}
				title="Method Comparison"
			/>
		</div>
	{/if}

	<!-- Method details -->
	{#if appStore.selectedMethods.length > 0}
		<div class="method-details">
			{#each appStore.selectedMethods as id}
				{@const method = methods.find((m) => m.id === id)!}
				<div class="detail-card">
					<h3>{method.shortName}</h3>
					<p class="detail-tagline">{method.tagline}</p>
					<div class="detail-section">
						<span class="detail-label">Best for</span>
						<ul>
							{#each method.bestFor as item}
								<li>{item}</li>
							{/each}
						</ul>
					</div>
					<div class="detail-section">
						<span class="detail-label">Red flags</span>
						<ul class="red-flags">
							{#each method.redFlags as item}
								<li>{item}</li>
							{/each}
						</ul>
					</div>
					<div class="detail-section">
						<span class="detail-label">Examples</span>
						<p class="detail-examples">{method.exampleServices}</p>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.compare-view {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		min-width: 0;
	}

	.table-scroll-wrapper {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	.method-toggles {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.toggles-label {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tx-3);
	}

	.method-toggle {
		padding: 0.375rem 0.75rem;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		background: var(--bg-2);
		color: var(--tx-2);
		border: 1px solid var(--ui);
		border-radius: var(--radius-full);
		cursor: pointer;
		transition: all 150ms ease;
	}

	.method-toggle:hover {
		border-color: var(--ui-2);
		color: var(--tx);
	}

	.method-toggle.selected {
		background: var(--primary);
		color: var(--primary-content);
		border-color: var(--primary);
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		color: var(--tx-3);
		font-family: var(--font-mono);
		font-size: 0.8125rem;
	}

	.method-details {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 1rem;
	}

	.detail-card {
		background: var(--bg-2);
		border: 1px solid var(--ui);
		border-radius: var(--radius-md);
		padding: 1rem;
	}

	.detail-card h3 {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tx);
		margin: 0 0 0.25rem;
	}

	.detail-tagline {
		font-size: 0.75rem;
		color: var(--tx-2);
		margin: 0 0 0.75rem;
	}

	.detail-section {
		margin-top: 0.75rem;
	}

	.detail-label {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tx-3);
		display: block;
		margin-bottom: 0.25rem;
	}

	.detail-section ul {
		margin: 0;
		padding-left: 1.25rem;
		font-size: 0.75rem;
		color: var(--tx-2);
	}

	.detail-section li {
		margin: 0.125rem 0;
	}

	.red-flags li {
		color: var(--error-text);
	}

	.detail-examples {
		font-size: 0.75rem;
		color: var(--tx-2);
		margin: 0;
	}

	@media (max-width: 640px) {
		.method-toggles {
			gap: 0.375rem;
		}

		.method-details {
			grid-template-columns: 1fr;
		}

		.empty-state {
			padding: 2rem 1rem;
		}
	}
</style>
