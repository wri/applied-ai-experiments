<script lang="ts">
	import {
		bimodalGap,
		ENSEMBLE_MODELS,
		MODEL_COLORS,
		MODEL_LABELS,
		RISK_CLASSES,
		type Agreement,
		type EnsembleModel
	} from '../shared/waterRisk';

	interface Props {
		values: Record<EnsembleModel, number>;
		mean: number;
		min: number;
		max: number;
		agreement: Agreement;
	}

	let { values, mean, min, max, agreement }: Props = $props();

	// fixed viewBox; scales with container width
	const W = 360;
	const H = 128;
	const X0 = 14;
	const X1 = W - 14;
	const BAND_Y = 24;
	const BAND_H = 56;
	const x = (v: number) => X0 + (Math.min(5, Math.max(0, v)) / 5) * (X1 - X0);

	// deterministic vertical jitter per model so coincident dots stay visible
	const DOT_Y: Record<EnsembleModel, number> = {
		h08: BAND_Y + 12,
		pcrglobwb: BAND_Y + 24,
		watergap2: BAND_Y + 34,
		cwatm: BAND_Y + 44,
		lpjml: BAND_Y + 18
	};

	const gap = $derived(bimodalGap(values));
	const bimodal = $derived(gap.gap > 1.5 && mean > gap.gapLo && mean < gap.gapHi);
</script>

<svg viewBox="0 0 {W} {H}" role="img" aria-label="ensemble strip plot">
	<!-- risk-class background bands -->
	{#each RISK_CLASSES as c, i (c.label)}
		<rect
			x={x(i)}
			y={BAND_Y}
			width={x(i + 1) - x(i)}
			height={BAND_H}
			fill={c.color}
			opacity="0.14"
		/>
	{/each}

	<!-- min–max spread band -->
	<rect
		x={x(min)}
		y={BAND_Y + 8}
		width={Math.max(2, x(max) - x(min))}
		height={BAND_H - 16}
		rx="4"
		class="spread"
	/>

	<!-- mean tick -->
	<line x1={x(mean)} y1={BAND_Y - 6} x2={x(mean)} y2={BAND_Y + BAND_H + 6} class="mean" />
	<text x={x(mean)} y={BAND_Y - 10} text-anchor="middle" class="mean-label">
		mean {mean.toFixed(2)}
	</text>

	<!-- model dots -->
	{#each ENSEMBLE_MODELS as m (m)}
		<circle cx={x(values[m])} cy={DOT_Y[m]} r="5" fill={MODEL_COLORS[m]} class="dot" />
	{/each}

	<!-- bimodal bracket: the mean falls in a gap no model occupies -->
	{#if bimodal}
		<path
			d="M {x(gap.gapLo)} {BAND_Y + BAND_H + 10} v 5 H {x(gap.gapHi)} v -5"
			class="bracket"
			fill="none"
		/>
		<text x={(x(gap.gapLo) + x(gap.gapHi)) / 2} y={BAND_Y + BAND_H + 28} text-anchor="middle" class="bracket-label">
			no model predicts this value
		</text>
	{/if}

	<!-- axis -->
	{#each [0, 1, 2, 3, 4, 5] as t (t)}
		<text x={x(t)} y={H - 4} text-anchor="middle" class="tick">{t}</text>
	{/each}
</svg>

<div class="model-row">
	{#each ENSEMBLE_MODELS as m (m)}
		<span class="model">
			<i style:background={MODEL_COLORS[m]}></i>
			{MODEL_LABELS[m]}
			<b>{values[m].toFixed(2)}</b>
		</span>
	{/each}
	<span class="agreement">agreement: {agreement}</span>
</div>

<style>
	svg {
		width: 100%;
		height: auto;
		display: block;
	}
	.spread {
		fill: var(--tx-3);
		opacity: 0.22;
	}
	.mean {
		stroke: var(--tx);
		stroke-width: 2;
	}
	.mean-label {
		font-family: var(--font-mono);
		font-size: 10px;
		fill: var(--tx-2);
	}
	.dot {
		stroke: var(--bg);
		stroke-width: 1.5;
	}
	.bracket {
		stroke: var(--tx-2);
		stroke-width: 1.2;
	}
	.bracket-label {
		font-family: var(--font-mono);
		font-size: 9.5px;
		fill: var(--tx-2);
		font-style: italic;
	}
	.tick {
		font-family: var(--font-mono);
		font-size: 9px;
		fill: var(--tx-3);
	}
	.model-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.75rem;
		margin-top: var(--space-2);
	}
	.model {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-2);
	}
	.model i {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex: none;
	}
	.model b {
		font-weight: 600;
		color: var(--tx);
	}
	.agreement {
		margin-left: auto;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-3);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
</style>
