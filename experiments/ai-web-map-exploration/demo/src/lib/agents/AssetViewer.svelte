<script lang="ts">
	import { marked } from 'marked';
	import Badge from '$lib/ui/Badge.svelte';
	import { Button } from '@wri-datalab/ui';
	import { Modal as Dialog } from '@wri-datalab/ui';
	import type { AgentStore, AssetPayload } from './AgentStore.svelte';

	type MapStatePayload = Extract<AssetPayload, { type: 'map-state' }>;

	interface Props {
		store: AgentStore;
		/** The demo owns layer semantics — the viewer only calls back. */
		onApply?: (p: MapStatePayload) => void;
		onRevert?: () => void;
	}

	let { store, onApply, onRevert }: Props = $props();

	const opened = $derived(store.openedAsset);
	let applied = $state(false);

	function close() {
		store.openAsset = null;
	}

	function apply(p: MapStatePayload) {
		onApply?.(p);
		applied = true;
	}

	function revert() {
		onRevert?.();
		applied = false;
	}
</script>

<Dialog
	open={opened !== null}
	title={opened ? opened.asset.name : ''}
	size="md"
	onclose={close}
>
	{#if opened}
		{@const { task, asset } = opened}
		<div class="meta">
			<Badge>{asset.kind}</Badge>
			<span class="by">produced by {task.name}</span>
		</div>
		{#if asset.detail}<p class="detail">{asset.detail}</p>{/if}

		{#if asset.payload?.type === 'stats'}
			<table>
				<tbody>
					{#each asset.payload.rows as [k, v] (k)}
						<tr><td class="k">{k}</td><td class="v">{v}</td></tr>
					{/each}
				</tbody>
			</table>
			{#if asset.payload.caption}<p class="caption">{asset.payload.caption}</p>{/if}
		{:else if asset.payload?.type === 'notes'}
			<div class="md">{@html marked.parse(asset.payload.markdown, { async: false })}</div>
		{:else if asset.payload?.type === 'map-state'}
			{@const p = asset.payload}
			<table>
				<tbody>
					<tr>
						<td class="k">camera</td>
						<td class="v">{p.camera.center[0].toFixed(3)}, {p.camera.center[1].toFixed(3)} · z{p.camera.zoom}</td>
					</tr>
					{#each Object.entries(p.layers) as [k, v] (k)}
						<tr><td class="k">{k}</td><td class="v">{v}</td></tr>
					{/each}
				</tbody>
			</table>
			{#if p.note}<p class="caption">{p.note}</p>{/if}
			<div class="row">
				<Button size="sm" variant="primary" onclick={() => apply(p)}>apply to map</Button>
				<Button size="sm" onclick={revert} disabled={!applied}>revert</Button>
			</div>
		{:else}
			<p class="caption">no inspectable payload attached</p>
		{/if}
	{/if}
</Dialog>

<style>
	.meta {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.by {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--tx-3);
	}
	.detail {
		margin: 0 0 var(--space-2);
		font-size: 0.75rem;
		color: var(--tx-2);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-mono);
		font-size: 0.7rem;
	}
	td {
		padding: 0.3rem 0.5rem;
		border-bottom: 1px solid var(--ui);
	}
	.k {
		color: var(--tx-3);
		text-transform: uppercase;
		font-size: 0.62rem;
		letter-spacing: 0.04em;
		white-space: nowrap;
	}
	.v {
		color: var(--tx);
	}
	.caption {
		margin: var(--space-2) 0 0;
		font-size: 0.68rem;
		color: var(--tx-3);
		font-style: italic;
	}
	.row {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
	.md {
		font-size: 0.75rem;
		color: var(--tx-2);
		line-height: 1.55;
	}
	.md :global(h2) {
		font-size: 0.8rem;
		margin: 0 0 0.4rem;
		color: var(--tx);
	}
	.md :global(ul) {
		margin: 0;
		padding-left: 1.1rem;
	}
	.md :global(li) {
		margin-bottom: 0.25rem;
	}
</style>
