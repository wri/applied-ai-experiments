<script lang="ts">
	import { Button, Badge } from '@wri-datalab/ui';
	import ModelPicker from './ModelPicker.svelte';
	import ChunkingPicker from './ChunkingPicker.svelte';
	import type { CompareVariant } from '../stores/comparison';
	import type { ChunkOptions, ChunkStrategyId } from '../types';

	interface Props {
		variant: CompareVariant;
		removable?: boolean;
		disabled?: boolean;
		onModelChange?: (modelId: string) => void;
		onChunkingChange?: (strategyId: ChunkStrategyId, options: ChunkOptions) => void;
		onRemove?: () => void;
	}

	let { variant, removable = false, disabled = false, onModelChange, onChunkingChange, onRemove }: Props =
		$props();

	let statusText = $derived(
		variant.status === 'building'
			? variant.buildPhase === 'chunking'
				? `chunking ${variant.completed}/${variant.total}`
				: `embedding ${variant.completed}/${variant.total}`
			: variant.status
	);
</script>

<div class="config-picker">
	<div class="head">
		<Badge variant="info">{variant.id}</Badge>
		<span class="status" class:ready={variant.status === 'ready'}>{statusText}</span>
		{#if removable}
			<Button variant="ghost" size="sm" {disabled} onclick={onRemove}>Remove</Button>
		{/if}
	</div>
	<div class="controls">
		<ModelPicker modelId={variant.modelId} {disabled} includeBm25 onChange={onModelChange} />
		<ChunkingPicker
			strategyId={variant.strategyId}
			options={variant.chunkOptions}
			{disabled}
			onChange={onChunkingChange}
		/>
	</div>
</div>

<style>
	.config-picker {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-3);
		background-color: var(--bg);
		border: 1px solid var(--ui);
		border-radius: var(--radius-md);
	}

	.head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.status {
		font-family: var(--font-mono);
		font-size: var(--font-size-xs);
		color: var(--tx-3);
		flex: 1;
	}

	.status.ready {
		color: var(--success-text, var(--tx-2));
	}

	.controls {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
	}

	@media (max-width: 640px) {
		.controls {
			grid-template-columns: 1fr;
		}
	}
</style>
