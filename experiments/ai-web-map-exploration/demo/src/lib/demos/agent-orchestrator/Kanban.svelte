<script lang="ts">
	import {
		STATUS_COLORS,
		STATUS_LABELS,
		STATUS_ORDER,
		type AgentStatus,
		type AgentStore
	} from '$lib/agents/AgentStore.svelte';
	import Badge from '$lib/ui/Badge.svelte';

	let { store }: { store: AgentStore } = $props();

	let dragId = $state<string | null>(null);
	let dragOver = $state<AgentStatus | null>(null);

	function drop(status: AgentStatus) {
		if (dragId) {
			store.setStatus(dragId, status);
			store.appendLog(dragId, `moved to ${STATUS_LABELS[status]} (manual)`);
		}
		dragId = null;
		dragOver = null;
	}
</script>

<div class="board">
	{#each STATUS_ORDER as status (status)}
		{@const cards = store.tasks.filter((t) => t.status === status)}
		<div
			class="col"
			class:drag-over={dragOver === status}
			role="list"
			aria-label={STATUS_LABELS[status]}
			ondragover={(e) => {
				e.preventDefault();
				dragOver = status;
			}}
			ondragleave={() => (dragOver = null)}
			ondrop={(e) => {
				e.preventDefault();
				drop(status);
			}}
		>
			<div class="col-head">
				<i style:background={STATUS_COLORS[status]}></i>
				{STATUS_LABELS[status]}
				<span class="n">{cards.length}</span>
			</div>
			{#each cards as t (t.id)}
				<div
					class="card"
					class:selected={store.selectedId === t.id}
					role="button"
					aria-pressed={store.selectedId === t.id}
					draggable="true"
					ondragstart={() => (dragId = t.id)}
					onclick={() => (store.selectedId = store.selectedId === t.id ? null : t.id)}
					onkeydown={(e) => {
						if (e.key === 'Enter') store.selectedId = t.id;
					}}
					tabindex="0"
				>
					<div class="card-top">
						<span class="name">{t.name}</span>
						<Badge>{t.role}</Badge>
					</div>
					<div class="desc">{t.description}</div>
					{#if t.assets.length}
						<div class="assets">
							{#each t.assets as a (a.id)}
								<button
									class="asset"
									title={a.detail}
									onclick={(e) => {
										e.stopPropagation();
										store.openAsset = { taskId: t.id, assetId: a.id };
									}}
								>{a.kind === 'layer' ? '▤' : a.kind === 'stats' ? '∑' : a.kind === 'map-state' ? '🗺' : '✎'} {a.name}</button>
							{/each}
						</div>
					{/if}
					{#if t.log.length}
						<div class="last-log">{t.log[t.log.length - 1].msg}</div>
					{/if}
				</div>
			{/each}
		</div>
	{/each}
</div>

<style>
	.board {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--space-3);
		height: 100%;
		align-items: start;
	}
	.col {
		background: var(--bg-2);
		border: 1px solid var(--ui);
		border-radius: var(--radius-md);
		padding: var(--space-2);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-height: 16rem;
		max-height: 100%;
		overflow-y: auto;
	}
	.col.drag-over {
		border-color: var(--primary);
	}
	.col-head {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tx-2);
		padding: 0.2rem 0.2rem 0.4rem;
	}
	.col-head i {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}
	.n {
		margin-left: auto;
		color: var(--tx-3);
	}
	.card {
		background: var(--bg);
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		padding: 0.5rem;
		cursor: grab;
	}
	.card:hover {
		border-color: var(--ui-3);
	}
	.card.selected {
		border-color: var(--primary);
	}
	.card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.name {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-weight: 500;
		color: var(--tx);
	}
	.desc {
		font-size: 0.68rem;
		color: var(--tx-2);
		line-height: 1.4;
		margin-top: 0.25rem;
	}
	.assets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-top: 0.35rem;
	}
	.asset {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		color: var(--primary);
		background: color-mix(in srgb, var(--primary) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--primary) 35%, transparent);
		border-radius: var(--radius-sm);
		padding: 0.08rem 0.3rem;
		cursor: pointer;
	}
	.asset:hover {
		background: color-mix(in srgb, var(--primary) 22%, transparent);
	}
	.last-log {
		margin-top: 0.35rem;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
