<script lang="ts">
	import { Button, Input } from '@wri-datalab/ui';

	interface Props {
		onFileSelect?: (file: File) => void;
		onUrlSubmit?: (url: string) => void;
		disabled?: boolean;
	}

	let { onFileSelect, onUrlSubmit, disabled = false }: Props = $props();

	let urlInput = $state('');
	let isDragOver = $state(false);
	let fileInput: HTMLInputElement;

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;

		if (disabled) return;

		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			const file = files[0];
			if (file.type === 'application/pdf') {
				onFileSelect?.(file);
			}
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (!disabled) {
			isDragOver = true;
		}
	}

	function handleDragLeave() {
		isDragOver = false;
	}

	function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file && file.type === 'application/pdf') {
			onFileSelect?.(file);
		}
	}

	function handleUrlSubmit() {
		if (urlInput.trim()) {
			onUrlSubmit?.(urlInput.trim());
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handleUrlSubmit();
		}
	}
</script>

<div class="document-input">
	<div
		class="drop-zone"
		class:drag-over={isDragOver}
		class:disabled
		ondrop={handleDrop}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		role="button"
		tabindex="0"
		onclick={() => !disabled && fileInput.click()}
		onkeydown={(e) => e.key === 'Enter' && !disabled && fileInput.click()}
	>
		<input
			bind:this={fileInput}
			type="file"
			accept="application/pdf"
			onchange={handleFileChange}
			{disabled}
		/>
		<div class="drop-content">
			<svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="17,8 12,3 7,8" />
				<line x1="12" y1="3" x2="12" y2="15" />
			</svg>
			<p class="drop-text">Drop a PDF file here</p>
			<p class="drop-hint">or click to browse</p>
		</div>
	</div>

	<div class="divider">
		<span>or</span>
	</div>

	<div class="url-input">
		<Input
			type="url"
			placeholder="Enter PDF URL..."
			bind:value={urlInput}
			{disabled}
			onkeydown={handleKeydown}
		/>
		<Button
			variant="primary"
			onclick={handleUrlSubmit}
			disabled={disabled || !urlInput.trim()}
		>
			Load
		</Button>
	</div>
</div>

<style>
	.document-input {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	.drop-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 200px;
		border: 2px dashed var(--ui);
		border-radius: var(--radius-lg);
		background-color: var(--bg-2);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.drop-zone:hover:not(.disabled) {
		border-color: var(--primary);
		background-color: var(--bg-3);
	}

	.drop-zone.drag-over {
		border-color: var(--primary);
		background-color: color-mix(in oklch, var(--primary) 10%, var(--bg-2));
	}

	.drop-zone.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.drop-zone input[type="file"] {
		display: none;
	}

	.drop-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
	}

	.upload-icon {
		width: 48px;
		height: 48px;
		color: var(--tx-3);
	}

	.drop-text {
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-medium);
		color: var(--tx);
		margin: 0;
	}

	.drop-hint {
		font-size: var(--font-size-sm);
		color: var(--tx-3);
		margin: 0;
	}

	.divider {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		color: var(--tx-3);
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background-color: var(--ui);
	}

	.url-input {
		display: flex;
		gap: var(--space-3);
	}

	.url-input :global(.ui-input) {
		flex: 1;
	}
</style>
