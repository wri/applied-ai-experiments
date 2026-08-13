<script lang="ts">
	import { Spinner } from '@wri-datalab/ui';
	import ModelPicker from './ModelPicker.svelte';
	import ChunkingPicker from './ChunkingPicker.svelte';
	import type { ChunkOptions, ChunkStrategyId, ModelStatus } from '../types';

	interface Props {
		modelId: string;
		strategyId: ChunkStrategyId;
		chunkOptions: ChunkOptions;
		building?: boolean;
		buildPhase?: 'chunking' | 'embedding';
		buildCompleted?: number;
		buildTotal?: number;
		modelStatus?: ModelStatus;
		modelProgress?: number;
		disabled?: boolean;
		onModelChange?: (id: string) => void;
		onChunkingChange?: (id: ChunkStrategyId, opts: ChunkOptions) => void;
	}

	let {
		modelId,
		strategyId,
		chunkOptions,
		building = false,
		buildPhase = 'chunking',
		buildCompleted = 0,
		buildTotal = 0,
		modelStatus = 'idle',
		modelProgress = 0,
		disabled = false,
		onModelChange,
		onChunkingChange
	}: Props = $props();

	// While building, the work moves through three phases: downloading/loading the
	// model, chunking the document, then embedding the chunks.
	let loadingModel = $derived(building && modelStatus === 'loading');

	let statusText = $derived(
		loadingModel
			? `Downloading model… ${Math.round(modelProgress)}%`
			: buildPhase === 'chunking'
				? buildTotal > 0
					? `Chunking ${buildCompleted}/${buildTotal} pages…`
					: 'Chunking…'
				: `Embedding ${buildCompleted}/${buildTotal} chunks…`
	);

	// Progress for the bar; 0 means "just started / indeterminate".
	let progressPct = $derived(
		loadingModel
			? modelProgress
			: buildTotal > 0
				? (buildCompleted / buildTotal) * 100
				: 0
	);
</script>

<div class="config-bar" class:building>
	<div class="controls">
		<div class="control">
			<ModelPicker {modelId} disabled={disabled || building} onChange={onModelChange} />
		</div>
		<div class="control">
			<ChunkingPicker
				{strategyId}
				options={chunkOptions}
				disabled={disabled || building}
				onChange={onChunkingChange}
			/>
		</div>
	</div>

	{#if building}
		<div class="build-status">
			<div class="status-line">
				<Spinner size="sm" />
				<span>{statusText}</span>
			</div>
			<div class="progress-track">
				<div
					class="progress-fill"
					class:indeterminate={progressPct === 0}
					style="width: {progressPct === 0 ? 100 : progressPct}%"
				></div>
			</div>
			<p class="hint">Re-embedding the document with the new settings — search updates when it finishes.</p>
		</div>
	{/if}
</div>

<style>
	.config-bar {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		background-color: var(--bg-2);
		border: 1px solid var(--ui);
		border-radius: var(--radius-md);
	}

	.config-bar.building {
		border-color: var(--primary);
	}

	.controls {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4);
	}

	.control {
		min-width: 0;
	}

	.build-status {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.status-line {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		color: var(--tx);
	}

	.progress-track {
		height: 4px;
		background-color: var(--bg-3);
		border-radius: var(--radius-full);
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background-color: var(--primary);
		border-radius: var(--radius-full);
		transition: width 0.25s ease;
	}

	.progress-fill.indeterminate {
		animation: pulse 1.1s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.35;
		}
		50% {
			opacity: 0.85;
		}
	}

	.hint {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--tx-3);
	}

	@media (max-width: 640px) {
		.controls {
			grid-template-columns: 1fr;
		}
	}
</style>
