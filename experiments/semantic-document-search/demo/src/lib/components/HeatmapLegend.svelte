<script lang="ts">
	// Static gradient legend explaining the heatmap shading. The amber ramp
	// mirrors PageThumbnail.getHeatmapColor (hue 85).
</script>

<div class="legend">
	<span class="label">less relevant</span>
	<div class="gradient"></div>
	<span class="label">more relevant</span>
	<span class="note">shading is relative to this search — deeper amber means a stronger match</span>
</div>

<style>
	.legend {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--font-size-xs);
		color: var(--tx-3);
		flex-wrap: wrap;
	}

	.gradient {
		width: 120px;
		height: 10px;
		border-radius: var(--radius-full);
		border: 1px solid var(--ui);
		background: linear-gradient(
			to right,
			oklch(70% 0.1 85 / 0.2),
			oklch(50% 0.27 85 / 0.65)
		);
	}

	.note {
		margin-left: var(--space-2);
		font-style: italic;
	}

	@media (max-width: 640px) {
		.note {
			margin-left: 0;
			flex-basis: 100%;
		}
	}
</style>
