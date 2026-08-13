<script lang="ts">
	import { Badge } from '@wri-datalab/ui';
	import { getModel } from '../embeddings/models';
	import type { Device } from '../types';

	interface Props {
		filename: string;
		pageCount: number;
		chunkCount: number;
		modelId: string;
		backend: Device | 'unknown';
	}

	let { filename, pageCount, chunkCount, modelId, backend }: Props = $props();
	let model = $derived(getModel(modelId));
</script>

<div class="doc-header">
	<h2 title={filename}>{filename}</h2>
	<div class="chips">
		<Badge variant="default">{pageCount} pages</Badge>
		{#if chunkCount > 0}<Badge variant="default">{chunkCount} chunks</Badge>{/if}
		<Badge variant="default">{model.label}</Badge>
		{#if backend === 'webgpu'}
			<Badge variant="success">WebGPU</Badge>
		{:else if backend === 'wasm'}
			<Badge variant="warning">WASM</Badge>
		{/if}
	</div>
</div>

<style>
	.doc-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	.doc-header h2 {
		margin: 0;
		font-size: var(--font-size-lg);
		max-width: 60ch;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
</style>
