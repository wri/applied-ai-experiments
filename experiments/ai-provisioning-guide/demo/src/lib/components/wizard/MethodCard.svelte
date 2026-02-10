<script lang="ts">
	import { Card, Badge } from '@wri-datalab/ui';
	import type { DeliveryMethod, MethodViability } from '$lib/types.js';
	import ViabilityIndicator from '../shared/ViabilityIndicator.svelte';

	interface Props {
		method: DeliveryMethod;
		viability?: MethodViability;
		compact?: boolean;
	}

	let { method, viability, compact = false }: Props = $props();
</script>

<Card padding={compact ? 'sm' : 'md'}>
	<div class="method-card" class:eliminated={viability?.viability === 'eliminated'}>
		<div class="method-header">
			<div class="method-name-row">
				<span class="method-name">{method.shortName}</span>
				{#if viability}
					<ViabilityIndicator viability={viability.viability} />
				{/if}
			</div>
			<span class="method-tagline">{method.tagline}</span>
		</div>

		{#if !compact}
			<div class="method-badges">
				<Badge>{method.category}</Badge>
				<Badge variant={method.characteristics.maxCapability === 'frontier' ? 'success' : method.characteristics.maxCapability === 'strong' ? 'info' : 'default'}>
					{method.characteristics.maxCapability}
				</Badge>
				{#if method.characteristics.offlineCapable}
					<Badge variant="info">Offline</Badge>
				{/if}
				{#if method.characteristics.multiProvider}
					<Badge variant="info">Multi-provider</Badge>
				{/if}
			</div>

			{#if viability && viability.reasons.length > 0}
				<div class="method-reasons">
					{#each viability.reasons as reason}
						<div class="reason">{reason}</div>
					{/each}
				</div>
			{/if}

			<div class="method-best-for">
				<span class="best-for-label">Best for:</span>
				{#each method.bestFor as item}
					<span class="best-for-item">{item}</span>
				{/each}
			</div>
		{/if}
	</div>
</Card>

<style>
	.method-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.method-card.eliminated {
		opacity: 0.5;
	}

	.method-header {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.method-name-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.method-name {
		font-family: var(--font-mono);
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--tx);
	}

	.method-tagline {
		font-size: 0.75rem;
		color: var(--tx-2);
	}

	.method-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.method-reasons {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem;
		background: var(--bg-3);
		border-radius: var(--radius-sm);
	}

	.reason {
		font-size: 0.75rem;
		color: var(--tx-2);
		line-height: 1.4;
	}

	.method-best-for {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		align-items: center;
	}

	.best-for-label {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		text-transform: uppercase;
		color: var(--tx-3);
		letter-spacing: 0.05em;
	}

	.best-for-item {
		font-size: 0.75rem;
		color: var(--tx-2);
		padding: 0.125rem 0.375rem;
		background: var(--bg-3);
		border-radius: var(--radius-sm);
	}
</style>
