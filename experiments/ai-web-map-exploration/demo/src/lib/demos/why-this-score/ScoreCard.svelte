<script lang="ts">
	import {
		dominantDrivers,
		GROUPS,
		INDICATOR_BY_CODE,
		riskClass,
		type Decomposition,
		type GroupId,
		type IndicatorCode
	} from '../shared/waterRisk';

	interface Props {
		decomp: Decomposition;
		focused: IndicatorCode | null;
		onfocus: (code: IndicatorCode | null) => void;
	}

	let { decomp, focused, onfocus }: Props = $props();

	const driverCodes = $derived(new Set(dominantDrivers(decomp, 3).map((c) => c.code)));
	const groupIds = Object.keys(GROUPS) as GroupId[];

	function groupSum(g: GroupId): number {
		return decomp.contributions
			.filter((c) => INDICATOR_BY_CODE[c.code].group === g)
			.reduce((s, c) => s + c.weighted, 0);
	}
</script>

<div class="card">
	{#each groupIds as g (g)}
		{@const group = decomp.groups.find((x) => x.id === g)!}
		<div class="group-head">
			<span>{GROUPS[g].label}</span>
			<span class="gw">group weight {group.weight.toFixed(2)}</span>
		</div>
		{#each decomp.contributions.filter((c) => INDICATOR_BY_CODE[c.code].group === g) as c (c.code)}
			{@const def = INDICATOR_BY_CODE[c.code]}
			<button
				class="row"
				class:nodata={c.noData}
				class:focused={focused === c.code}
				title={def.description}
				onclick={() => onfocus(focused === c.code ? null : c.code)}
			>
				<span class="code">{c.code}</span>
				<span class="label">
					{def.label}
					{#if driverCodes.has(c.code)}<em class="driver">driver</em>{/if}
				</span>
				{#if c.noData}
					<span class="arith muted">-9999 · excluded, weights renormalized</span>
				{:else}
					<span class="bar"><i style:width="{(c.value / 5) * 100}%" style:background={riskClass(c.value).color}></i></span>
					<span class="arith">{c.value.toFixed(1)} × {c.weight.toFixed(3)} = {c.weighted.toFixed(3)}</span>
				{/if}
			</button>
		{/each}
		<div class="subtotal">
			<span>subtotal</span>
			<span>{groupSum(g).toFixed(3)}</span>
		</div>
	{/each}
	<div class="total">
		<span>overall (sums exactly)</span>
		<span class="total-score" style:color={riskClass(decomp.overall).color}>
			{decomp.overall.toFixed(2)}
		</span>
	</div>
	{#if focused}
		<button class="back" onclick={() => onfocus(null)}>← back to overall score on the map</button>
	{/if}
</div>

<style>
	.card {
		display: flex;
		flex-direction: column;
	}
	.group-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tx-3);
		padding: var(--space-2) 0 0.25rem;
		border-bottom: 1px solid var(--ui);
	}
	.gw {
		text-transform: none;
		letter-spacing: 0;
	}
	.row {
		display: grid;
		grid-template-columns: 2rem 1fr 4.2rem 9.5rem;
		align-items: center;
		gap: 0.4rem;
		width: 100%;
		background: none;
		border: none;
		border-bottom: 1px solid color-mix(in srgb, var(--ui) 45%, transparent);
		padding: 0.28rem 0;
		cursor: pointer;
		text-align: left;
	}
	.row:hover {
		background: var(--bg-3);
	}
	.row.focused {
		background: var(--bg-3);
		box-shadow: inset 2px 0 0 var(--primary);
	}
	.code {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		font-weight: 600;
		color: var(--tx-2);
	}
	.label {
		font-size: 0.7rem;
		color: var(--tx);
		line-height: 1.25;
	}
	.driver {
		font-family: var(--font-mono);
		font-size: 0.55rem;
		font-style: normal;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--primary);
		border: 1px solid var(--primary);
		border-radius: var(--radius-sm);
		padding: 0 0.25rem;
		margin-left: 0.3rem;
	}
	.bar {
		height: 7px;
		background: var(--bg-3);
		border-radius: 3px;
		overflow: hidden;
	}
	.bar i {
		display: block;
		height: 100%;
		border-radius: 3px;
	}
	.arith {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-2);
		text-align: right;
		white-space: nowrap;
	}
	.row.nodata .label {
		color: var(--tx-3);
	}
	.muted {
		grid-column: 3 / 5;
		color: var(--tx-3);
	}
	.subtotal {
		display: flex;
		justify-content: space-between;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-2);
		padding: 0.25rem 0 var(--space-2);
	}
	.total {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		border-top: 2px solid var(--ui);
		margin-top: var(--space-1);
		padding-top: var(--space-2);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--tx);
	}
	.total-score {
		font-size: 1.05rem;
		font-weight: 700;
	}
	.back {
		margin-top: var(--space-2);
		background: none;
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-2);
		padding: 0.25rem 0.5rem;
		cursor: pointer;
	}
	.back:hover {
		border-color: var(--primary);
		color: var(--primary);
	}
</style>
