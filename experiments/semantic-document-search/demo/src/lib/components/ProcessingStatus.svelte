<script lang="ts">
	import { Spinner } from '@wri-datalab/ui';
	import type { DocumentStatus, ModelStatus } from '../types';

	interface Props {
		documentStatus: DocumentStatus;
		documentProgress: number;
		modelStatus: ModelStatus;
		modelProgress: number;
		modelMessage: string;
		totalPages?: number;
		currentPage?: number;
		totalChunks?: number;
		embeddedChunks?: number;
	}

	let {
		documentStatus,
		documentProgress,
		modelStatus,
		modelProgress,
		modelMessage,
		totalPages = 0,
		currentPage = 0,
		totalChunks = 0,
		embeddedChunks = 0
	}: Props = $props();

	const phases = ['loading', 'parsing', 'extracting', 'embedding', 'ready'] as const;

	function getPhaseIndex(status: DocumentStatus): number {
		const index = phases.indexOf(status as typeof phases[number]);
		return index >= 0 ? index : 0;
	}

	function getStatusMessage(): string {
		switch (documentStatus) {
			case 'loading':
				return 'Loading PDF...';
			case 'parsing':
				return `Parsing document (${totalPages} pages)...`;
			case 'extracting':
				return `Extracting text from page ${currentPage} of ${totalPages}...`;
			case 'embedding':
				if (modelStatus === 'loading') {
					return modelMessage || 'Loading embedding model...';
				}
				return `Generating embeddings (${embeddedChunks}/${totalChunks} chunks)...`;
			case 'ready':
				return 'Ready to search!';
			case 'error':
				return 'An error occurred';
			default:
				return 'Processing...';
		}
	}

	function getOverallProgress(): number {
		const phaseIndex = getPhaseIndex(documentStatus);
		const phaseWeight = 100 / phases.length;
		const completedPhases = phaseIndex * phaseWeight;

		let currentPhaseProgress = 0;
		if (documentStatus === 'embedding' && modelStatus === 'loading') {
			currentPhaseProgress = modelProgress * 0.5;
		} else if (documentStatus === 'embedding' && totalChunks > 0) {
			currentPhaseProgress = 50 + (embeddedChunks / totalChunks) * 50;
		} else {
			currentPhaseProgress = documentProgress;
		}

		return Math.min(completedPhases + (currentPhaseProgress / 100) * phaseWeight, 100);
	}

	let overallProgress = $derived(getOverallProgress());
	let statusMessage = $derived(getStatusMessage());
</script>

<div class="processing-status">
	<div class="status-header">
		<Spinner size="sm" />
		<span class="status-message">{statusMessage}</span>
	</div>

	<div class="progress-container">
		<div class="progress-bar">
			<div class="progress-fill" style="width: {overallProgress}%"></div>
		</div>
		<span class="progress-percent">{Math.round(overallProgress)}%</span>
	</div>

	<div class="phase-indicators">
		{#each phases as phase, i}
			{@const currentIndex = getPhaseIndex(documentStatus)}
			{@const isComplete = i < currentIndex}
			{@const isActive = i === currentIndex}
			<div
				class="phase-dot"
				class:complete={isComplete}
				class:active={isActive}
				title={phase}
			></div>
			{#if i < phases.length - 1}
				<div
					class="phase-line"
					class:complete={isComplete}
				></div>
			{/if}
		{/each}
	</div>

	<div class="phase-labels">
		<span>Load</span>
		<span>Parse</span>
		<span>Extract</span>
		<span>Embed</span>
		<span>Ready</span>
	</div>
</div>

<style>
	.processing-status {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-6);
		background-color: var(--bg-2);
		border: 1px solid var(--ui);
		border-radius: var(--radius-lg);
	}

	.status-header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.status-message {
		font-size: var(--font-size-sm);
		color: var(--tx-2);
	}

	.progress-container {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.progress-bar {
		flex: 1;
		height: 8px;
		background-color: var(--bg-3);
		border-radius: var(--radius-full);
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background-color: var(--primary);
		border-radius: var(--radius-full);
		transition: width 0.3s ease;
	}

	.progress-percent {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		color: var(--tx);
		min-width: 3ch;
		text-align: right;
	}

	.phase-indicators {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--space-1);
	}

	.phase-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background-color: var(--bg-3);
		border: 2px solid var(--ui);
		transition: all var(--transition-fast);
	}

	.phase-dot.complete {
		background-color: var(--primary);
		border-color: var(--primary);
	}

	.phase-dot.active {
		background-color: var(--bg);
		border-color: var(--primary);
		box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 30%, transparent);
	}

	.phase-line {
		flex: 1;
		height: 2px;
		background-color: var(--ui);
		margin: 0 var(--space-1);
		transition: background-color var(--transition-fast);
	}

	.phase-line.complete {
		background-color: var(--primary);
	}

	.phase-labels {
		display: flex;
		justify-content: space-between;
		font-size: var(--font-size-xs);
		color: var(--tx-3);
	}
</style>
