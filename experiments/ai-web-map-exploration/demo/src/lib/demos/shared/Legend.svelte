<script lang="ts">
	export interface LegendEntry {
		color: string;
		label: string;
	}

	interface Props {
		title: string;
		entries: LegendEntry[];
		note?: string;
	}

	let { title, entries, note }: Props = $props();
</script>

<div class="legend">
	<div class="title">{title}</div>
	{#each entries as e (e.label)}
		<div class="row"><i style:background={e.color}></i><span>{e.label}</span></div>
	{/each}
	{#if note}<div class="note">{note}</div>{/if}
</div>

<style>
	.legend {
		position: absolute;
		bottom: var(--space-6);
		left: var(--space-4);
		z-index: 20;
		background: color-mix(in srgb, var(--bg) 88%, transparent);
		border: 1px solid var(--ui);
		border-radius: var(--radius-md);
		padding: var(--space-2) var(--space-3);
		max-width: 16rem;
	}
	.title {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tx-2);
		margin-bottom: 0.35rem;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--tx);
		padding: 0.1rem 0;
	}
	.row i {
		width: 11px;
		height: 11px;
		border-radius: 2px;
		flex: none;
		border: 1px solid oklch(0 0 0 / 0.2);
	}
	.note {
		margin-top: 0.35rem;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-3);
		line-height: 1.4;
	}
</style>
