<script lang="ts">
	import { Select, Badge } from '@wri-datalab/ui';
	import { MODEL_REGISTRY, getModel } from '../embeddings/models';
	import { BM25_BASELINE, isBm25 } from '../embeddings/bm25';

	interface Props {
		modelId: string;
		disabled?: boolean;
		includeBm25?: boolean; // offer the BM25 keyword baseline (compare view only)
		onChange?: (modelId: string) => void;
	}

	let { modelId, disabled = false, includeBm25 = false, onChange }: Props = $props();

	const baseOptions = MODEL_REGISTRY.map((m) => ({
		value: m.id,
		label: `${m.label} · ${m.dims}d · ~${m.approxSizeMB}MB${m.heavy ? ' (large)' : ''}`
	}));

	let options = $derived(
		includeBm25 ? [...baseOptions, { value: BM25_BASELINE.id, label: BM25_BASELINE.label }] : baseOptions
	);

	let lexical = $derived(isBm25(modelId));
	let model = $derived(lexical ? null : getModel(modelId));
</script>

<div class="model-picker">
	<Select
		value={modelId}
		{options}
		{disabled}
		label={includeBm25 ? 'Model / method' : 'Embedding model'}
		onchange={(v) => onChange?.(v)}
	/>
	<div class="meta">
		{#if lexical}
			<Badge variant="info">keyword baseline</Badge>
			<span class="notes">{BM25_BASELINE.note}</span>
		{:else if model}
			{#if model.multilingual}<Badge variant="info">multilingual</Badge>{/if}
			{#if model.heavy}<Badge variant="warning">large download</Badge>{/if}
			{#if model.notes}<span class="notes">{model.notes}</span>{/if}
		{/if}
	</div>
</div>

<style>
	.model-picker {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--font-size-xs);
		color: var(--tx-3);
	}

	.notes {
		font-size: var(--font-size-xs);
		color: var(--tx-3);
	}
</style>
