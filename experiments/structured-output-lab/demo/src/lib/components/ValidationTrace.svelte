<script lang="ts">
	import { Alert, Badge, Button } from '@wri-datalab/ui';
	import type { SchemaIssue } from '@wri-datalab/llm-lab';

	interface Props {
		valid: boolean;
		issues: SchemaIssue[];
		hasRun: boolean;
		canRepair: boolean;
		repairing: boolean;
		repairCount: number;
		onrepair: () => void;
	}

	let { valid, issues, hasRun, canRepair, repairing, repairCount, onrepair }: Props = $props();
</script>

{#if !hasRun}
	<p class="trace-empty">Run an extraction to see the validation trace.</p>
{:else if valid}
	<Alert variant="success">
		Output conforms to the schema{repairCount > 0 ? ` after ${repairCount} repair${repairCount === 1 ? '' : 's'}` : ''}.
	</Alert>
{:else}
	<Alert variant="error">
		Validation failed with {issues.length} issue{issues.length === 1 ? '' : 's'}.
	</Alert>
	<ul class="trace-list">
		{#each issues as issue, i (i)}
			<li class="trace-item">
				<Badge variant="error">{issue.keyword}</Badge>
				<span class="trace-message">{issue.message}</span>
			</li>
		{/each}
	</ul>
	<div class="trace-actions">
		<Button variant="primary" size="sm" loading={repairing} disabled={!canRepair} onclick={onrepair}>
			Repair output
		</Button>
		{#if repairCount > 0}
			<Badge variant="warning">{repairCount} repair{repairCount === 1 ? '' : 's'} attempted</Badge>
		{/if}
		{#if !canRepair && !repairing}
			<span class="trace-note">Repair limit reached — adjust the schema or input and rerun.</span>
		{/if}
	</div>
{/if}

<style>
	.trace-empty {
		color: var(--tx-2);
		font-size: 0.875rem;
	}

	.trace-list {
		list-style: none;
		margin: var(--space-3, 0.75rem) 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2, 0.5rem);
	}

	.trace-item {
		display: flex;
		align-items: baseline;
		gap: var(--space-2, 0.5rem);
		padding: var(--space-2, 0.5rem);
		border: 1px solid var(--error, #b91c1c);
		border-radius: var(--radius-sm, 4px);
		background: color-mix(in srgb, var(--error, #b91c1c) 8%, transparent);
	}

	.trace-message {
		font-family: var(--font-mono);
		font-size: 0.8rem;
	}

	.trace-actions {
		display: flex;
		align-items: center;
		gap: var(--space-3, 0.75rem);
		margin-top: var(--space-3, 0.75rem);
		flex-wrap: wrap;
	}

	.trace-note {
		font-size: 0.75rem;
		color: var(--tx-2);
	}
</style>
