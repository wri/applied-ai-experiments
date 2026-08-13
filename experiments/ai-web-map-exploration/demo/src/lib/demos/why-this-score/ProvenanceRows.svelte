<script lang="ts">
	import Badge from '$lib/ui/Badge.svelte';
	import { INDICATORS, NO_DATA, type IndicatorCode } from '../shared/waterRisk';

	interface Props {
		/** indicator to force-open (e.g. the one focused in the score card) */
		openCode?: IndicatorCode | null;
		/** basin props — rows show a no-data marker when this basin lacks the indicator */
		values: Partial<Record<IndicatorCode, number>>;
	}

	let { openCode = null, values }: Props = $props();

	let toggled = $state<Record<string, boolean>>({});

	const METHOD_TONE = { modelled: 'info', observed: 'success', proxy: 'warning' } as const;

	function isOpen(code: IndicatorCode): boolean {
		return toggled[code] ?? openCode === code;
	}
</script>

{#each INDICATORS as d (d.code)}
	{@const noData = values[d.code] === NO_DATA}
	<div class="prov" class:open={isOpen(d.code)}>
		<button
			class="head"
			onclick={() => (toggled = { ...toggled, [d.code]: !isOpen(d.code) })}
		>
			<span class="code">{d.code}</span>
			<span class="name">{d.label}{#if noData}<em class="nd">no data here</em>{/if}</span>
			<Badge tone={METHOD_TONE[d.provenance.method]}>{d.provenance.method}</Badge>
			<span class="meta">{d.provenance.vintage} · {d.provenance.resolutionLabel}</span>
		</button>
		{#if isOpen(d.code)}
			<div class="body">
				<div class="src">{d.provenance.source}</div>
				<p class="caveat">{d.provenance.caveat}</p>
				{#if noData}
					<p class="nd-doc">
						This basin carries {NO_DATA} for {d.code}: insufficient input data to compute the
						indicator. It is excluded from the weighted sum (remaining weights renormalize). It
						does <b>not</b> mean zero risk.
					</p>
				{/if}
			</div>
		{/if}
	</div>
{/each}

<style>
	.prov {
		border-bottom: 1px solid var(--ui);
	}
	.head {
		display: grid;
		grid-template-columns: 2rem 1fr auto auto;
		align-items: center;
		gap: 0.4rem;
		width: 100%;
		background: none;
		border: none;
		padding: 0.35rem var(--space-3);
		cursor: pointer;
		text-align: left;
	}
	.head:hover {
		background: var(--bg-3);
	}
	.code {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		font-weight: 600;
		color: var(--tx-2);
	}
	.name {
		font-size: 0.7rem;
		color: var(--tx);
	}
	.nd {
		font-family: var(--font-mono);
		font-size: 0.55rem;
		font-style: normal;
		text-transform: uppercase;
		color: var(--error-text);
		margin-left: 0.35rem;
	}
	.meta {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		color: var(--tx-3);
		white-space: nowrap;
	}
	.body {
		padding: 0 var(--space-3) var(--space-2) calc(2rem + var(--space-3) + 0.4rem);
	}
	.src {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-2);
	}
	.caveat {
		margin: 0.25rem 0 0;
		font-size: 0.68rem;
		line-height: 1.5;
		color: var(--tx-2);
	}
	.nd-doc {
		margin: 0.35rem 0 0;
		font-size: 0.68rem;
		line-height: 1.5;
		color: var(--error-text);
	}
</style>
