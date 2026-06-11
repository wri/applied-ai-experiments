<script lang="ts">
	import { Button, Badge } from '@wri-datalab/ui';
	import type { ExampleDoc } from '../data/examples';

	interface Props {
		examples: ExampleDoc[];
		disabled?: boolean;
		onSelect?: (doc: ExampleDoc) => void;
	}

	let { examples, disabled = false, onSelect }: Props = $props();
</script>

<div class="example-picker">
	<p class="lead">New here? Load a sample document and search it instantly.</p>
	<div class="example-list">
		{#each examples as doc}
			<div class="example-card">
				<div class="example-meta">
					<strong>{doc.label}</strong>
					<p>{doc.description}</p>
				</div>
				<div class="example-action">
					<Badge variant="default">{doc.pages}p</Badge>
					<Button variant="secondary" size="sm" {disabled} onclick={() => onSelect?.(doc)}>
						Load
					</Button>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.example-picker {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.lead {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--tx-2);
	}

	.example-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.example-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3);
		background-color: var(--bg);
		border: 1px solid var(--ui);
		border-radius: var(--radius-md);
	}

	.example-meta {
		min-width: 0;
	}

	.example-meta strong {
		display: block;
		font-size: var(--font-size-sm);
	}

	.example-meta p {
		margin: var(--space-1) 0 0;
		font-size: var(--font-size-xs);
		color: var(--tx-3);
	}

	.example-action {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-shrink: 0;
	}
</style>
