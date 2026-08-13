<script lang="ts">
	import { Select } from '@wri-datalab/ui';
	import SliderParam from './SliderParam.svelte';
	import { CHUNK_STRATEGY_LIST, getStrategy } from '../embeddings/chunkers';
	import type { ChunkOptions, ChunkStrategyId } from '../types';

	interface Props {
		strategyId: ChunkStrategyId;
		options: ChunkOptions;
		disabled?: boolean;
		// Emitted on any change. The parent dedupes by embedding-set key, so a
		// redundant emit is free.
		onChange?: (strategyId: ChunkStrategyId, options: ChunkOptions) => void;
	}

	let { strategyId, options, disabled = false, onChange }: Props = $props();

	const strategyOptions = CHUNK_STRATEGY_LIST.map((s) => ({ value: s.id, label: s.label }));
	let strategy = $derived(getStrategy(strategyId));

	// Slider values are derived from the `options` prop (the source of truth held
	// by the parent), never from lagging local state — so a strategy switch can't
	// leave a slider bound to undefined.
	function paramValue(key: 'size' | 'overlap'): number {
		return (
			(options[key] as number | undefined) ??
			(strategy.defaults[key] as number | undefined) ??
			0
		);
	}

	function currentOptions(): ChunkOptions {
		const opts: ChunkOptions = {};
		for (const spec of strategy.paramSpec) opts[spec.key] = paramValue(spec.key);
		return opts;
	}

	function handleStrategy(v: string) {
		const next = v as ChunkStrategyId;
		onChange?.(next, { ...getStrategy(next).defaults });
	}

	function handleParam(key: 'size' | 'overlap', value: number) {
		onChange?.(strategyId, { ...currentOptions(), [key]: value });
	}
</script>

<div class="chunking-picker">
	<Select
		value={strategyId}
		options={strategyOptions}
		{disabled}
		label="Chunking"
		onchange={handleStrategy}
	/>
	<p class="desc">{strategy.description}</p>
	{#if strategy.paramSpec.length > 0}
		<div class="params">
			{#each strategy.paramSpec as spec (strategyId + '-' + spec.key)}
				<SliderParam
					initial={paramValue(spec.key)}
					min={spec.min}
					max={spec.max}
					step={spec.step}
					label={spec.label}
					unitLabel={spec.unitLabel}
					{disabled}
					onChange={(v) => handleParam(spec.key, v)}
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.chunking-picker {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}

	.desc {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--tx-3);
	}

	.params {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin-top: var(--space-1);
	}
</style>
