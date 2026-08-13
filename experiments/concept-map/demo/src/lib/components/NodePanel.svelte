<script lang="ts">
	import { Panel, Badge, Button, Spinner } from '@wri-datalab/ui';
	import type { PositionedNode, ConceptEdge } from '../graph/types';

	interface Props {
		node: PositionedNode;
		nodes: PositionedNode[];
		edges: ConceptEdge[];
		expanding: boolean;
		onexpand: (id: string) => void;
		onselect: (id: string | null) => void;
	}

	let { node, nodes, edges, expanding, onexpand, onselect }: Props = $props();

	const labelById = $derived(new Map(nodes.map((n) => [n.id, n.label])));

	const connections = $derived(
		edges
			.filter((edge) => edge.source === node.id || edge.target === node.id)
			.map((edge) => {
				const otherId = edge.source === node.id ? edge.target : edge.source;
				return {
					edge,
					otherId,
					otherLabel: labelById.get(otherId) ?? otherId,
					outgoing: edge.source === node.id,
				};
			})
	);
</script>

<Panel title={node.label}>
	{#snippet actions()}
		<Button variant="ghost" size="sm" onclick={() => onselect(null)}>Close</Button>
	{/snippet}

	<div class="meta">
		<Badge>{node.type}</Badge>
		<code class="node-id">{node.id}</code>
	</div>

	<p class="description">{node.description}</p>

	<h3 class="section-label">Connections</h3>
	{#if connections.length === 0}
		<p class="muted">No edges touch this node.</p>
	{:else}
		<ul class="connections">
			{#each connections as connection (`${connection.edge.source}|${connection.edge.target}|${connection.edge.relationship}`)}
				<li>
					<div class="connection-head">
						<Badge variant="info">{connection.edge.relationship}</Badge>
						<button
							type="button"
							class="node-link"
							onclick={() => onselect(connection.otherId)}
						>
							{connection.outgoing ? '→' : '←'} {connection.otherLabel}
						</button>
					</div>
					<p class="explanation">{connection.edge.explanation}</p>
				</li>
			{/each}
		</ul>
	{/if}

	{#if node.follow_up_questions && node.follow_up_questions.length > 0}
		<h3 class="section-label">Follow-up questions</h3>
		<ul class="follow-ups">
			{#each node.follow_up_questions as question (question)}
				<li>{question}</li>
			{/each}
		</ul>
	{/if}

	<div class="expand-row">
		<Button variant="primary" disabled={expanding} onclick={() => onexpand(node.id)}>
			{expanding ? 'Expanding…' : 'Expand this node'}
		</Button>
		{#if expanding}
			<Spinner size="sm" />
		{/if}
	</div>
</Panel>

<style>
	.meta {
		display: flex;
		align-items: center;
		gap: var(--space-2, 0.5rem);
		margin-bottom: var(--space-3, 0.75rem);
	}

	.node-id {
		font-size: 0.7rem;
		color: var(--tx-2);
	}

	.description {
		margin: 0 0 var(--space-4, 1rem);
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.section-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tx-2);
		margin: var(--space-4, 1rem) 0 var(--space-2, 0.5rem);
	}

	.muted {
		color: var(--tx-2);
		font-size: 0.8rem;
	}

	.connections {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3, 0.75rem);
	}

	.connection-head {
		display: flex;
		align-items: center;
		gap: var(--space-2, 0.5rem);
		flex-wrap: wrap;
	}

	.node-link {
		background: none;
		border: none;
		padding: 0;
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--text-link, var(--tx));
		cursor: pointer;
		text-decoration: underline;
	}

	.explanation {
		margin: var(--space-1, 0.25rem) 0 0;
		font-size: 0.8rem;
		color: var(--tx-2);
		line-height: 1.45;
	}

	.follow-ups {
		margin: 0;
		padding-left: var(--space-4, 1rem);
		font-size: 0.8rem;
		color: var(--tx-2);
		display: flex;
		flex-direction: column;
		gap: var(--space-1, 0.25rem);
	}

	.expand-row {
		display: flex;
		align-items: center;
		gap: var(--space-2, 0.5rem);
		margin-top: var(--space-5, 1.25rem);
	}
</style>
