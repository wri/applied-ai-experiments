<script lang="ts">
	import { Card, Badge, Skeleton, StreamingMarkdown, LatencyBadge, Button } from '@wri-datalab/ui';
	import type { Trial } from '../state/trials.svelte';

	interface Props {
		trial: Trial;
		highlighted?: boolean;
		oninspect: (trial: Trial) => void;
	}

	let { trial, highlighted = false, oninspect }: Props = $props();
</script>

<div class="run-card" class:highlighted id="run-card-{trial.index}">
	<Card padding="sm">
		<div class="run-card-head">
			<span class="run-card-title">Run {trial.index + 1}</span>
			{#if trial.status === 'pending'}
				<Badge>queued</Badge>
			{:else if trial.status === 'running'}
				<Badge variant="info">running</Badge>
			{:else if trial.status === 'error'}
				<Badge variant="error">error</Badge>
			{:else}
				<LatencyBadge ms={trial.latencyMs} size="sm" />
			{/if}
			{#if trial.request}
				<Button variant="ghost" size="sm" onclick={() => oninspect(trial)}>Inspect</Button>
			{/if}
		</div>
		{#if trial.status === 'pending'}
			<Skeleton lines={3} />
		{:else if trial.status === 'error'}
			<p class="run-card-error">{trial.error}</p>
		{:else}
			<div class="run-card-body">
				<StreamingMarkdown content={trial.content} streaming={trial.status === 'running'} />
			</div>
		{/if}
	</Card>
</div>

<style>
	.run-card.highlighted {
		outline: 2px solid var(--accent, #d97706);
		border-radius: var(--radius-md, 6px);
	}

	.run-card-head {
		display: flex;
		align-items: center;
		gap: var(--space-2, 0.5rem);
		margin-bottom: var(--space-2, 0.5rem);
	}

	.run-card-title {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		font-weight: 600;
		margin-right: auto;
	}

	.run-card-body {
		font-size: 0.8rem;
		max-height: 14rem;
		overflow-y: auto;
	}

	.run-card-error {
		color: var(--error, #b91c1c);
		font-size: 0.8rem;
		font-family: var(--font-mono);
	}
</style>
