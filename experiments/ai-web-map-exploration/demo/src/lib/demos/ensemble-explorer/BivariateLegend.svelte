<script lang="ts">
	import { RISK_CLASSES, VSUP, type Agreement } from '../shared/waterRisk';

	interface Props {
		note?: string;
	}

	let { note }: Props = $props();

	const ROWS: Exclude<Agreement, 'nodata'>[] = ['high', 'medium', 'low'];
</script>

<div class="legend">
	<div class="title">risk (ensemble mean) →</div>
	<div class="grid">
		{#each ROWS as a (a)}
			<div class="row">
				<span class="row-label">{a}</span>
				{#each VSUP[a] as color, i (i)}
					<i style:background={color} title="{RISK_CLASSES[i].label} · {a} agreement"></i>
				{/each}
			</div>
		{/each}
	</div>
	<div class="y-caption">↑ model agreement — hue washes out as models disagree</div>
	<div class="x-labels">
		<span>{RISK_CLASSES[0].label}</span>
		<span>{RISK_CLASSES[4].label}</span>
	</div>
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
	.grid {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 2px;
	}
	.row-label {
		width: 3.4rem;
		font-family: var(--font-mono);
		font-size: 0.58rem;
		color: var(--tx-3);
		text-align: right;
		padding-right: 0.3rem;
		flex: none;
	}
	.row i {
		width: 22px;
		height: 13px;
		border-radius: 2px;
		border: 1px solid oklch(0 0 0 / 0.15);
	}
	.y-caption {
		margin-top: 0.3rem;
		font-family: var(--font-mono);
		font-size: 0.58rem;
		color: var(--tx-3);
	}
	.x-labels {
		display: flex;
		justify-content: space-between;
		margin-left: 3.7rem;
		font-family: var(--font-mono);
		font-size: 0.58rem;
		color: var(--tx-3);
		width: calc(5 * 24px);
	}
	.note {
		margin-top: 0.35rem;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-3);
		line-height: 1.4;
		border-top: 1px solid var(--ui);
		padding-top: 0.3rem;
	}
</style>
