<script lang="ts">
	import { Panel } from '@wri-datalab/ui';
	import { appStore } from '$lib/stores/app.svelte.js';
	import { methods } from '$lib/data/methods.js';
	import { SLIDER_RANGES } from '$lib/data/defaults.js';
	import type { MethodId } from '$lib/types.js';
	import { formatCurrency } from '$lib/utils/format.js';
	import AssumptionSlider from './AssumptionSlider.svelte';

	let collapsed = $state(true);

	const selectedMethodDetails = $derived(
		appStore.selectedMethods.map((id) => ({
			id,
			method: methods.find((m) => m.id === id)!,
			assumptions: appStore.assumptions[id],
		})),
	);
</script>

<Panel title="Assumptions" collapsible bind:collapsed>
	<div class="assumptions-grid">
		{#each selectedMethodDetails as { id, method, assumptions } (id)}
			<div class="method-assumptions">
				<h3 class="method-name">{method.shortName}</h3>

				<div class="assumption-fields">
					{#if assumptions.inputTokenPricePerMillion > 0 || assumptions.outputTokenPricePerMillion > 0}
						<AssumptionSlider
							label="Input $/M tokens"
							value={assumptions.inputTokenPricePerMillion}
							min={SLIDER_RANGES.inputPrice.min} max={SLIDER_RANGES.inputPrice.max} step={SLIDER_RANGES.inputPrice.step}
							formatValue={(v) => '$' + v.toFixed(2)}
							onchange={(v) => appStore.updateAssumptions(id, { inputTokenPricePerMillion: v })}
						/>
						<AssumptionSlider
							label="Output $/M tokens"
							value={assumptions.outputTokenPricePerMillion}
							min={SLIDER_RANGES.outputPrice.min} max={SLIDER_RANGES.outputPrice.max} step={SLIDER_RANGES.outputPrice.step}
							formatValue={(v) => '$' + v.toFixed(2)}
							onchange={(v) => appStore.updateAssumptions(id, { outputTokenPricePerMillion: v })}
						/>
					{/if}

					{#if assumptions.routerMarkupPercent > 0}
						<AssumptionSlider
							label="Router markup"
							value={assumptions.routerMarkupPercent}
							min={SLIDER_RANGES.routerMarkup.min} max={SLIDER_RANGES.routerMarkup.max} step={SLIDER_RANGES.routerMarkup.step}
							formatValue={(v) => v + '%'}
							onchange={(v) => appStore.updateAssumptions(id, { routerMarkupPercent: v })}
						/>
					{/if}

					{#if assumptions.monthlyInfraCost > 0}
						<AssumptionSlider
							label="Monthly infra"
							value={assumptions.monthlyInfraCost}
							min={SLIDER_RANGES.monthlyInfra.min} max={SLIDER_RANGES.monthlyInfra.max} step={SLIDER_RANGES.monthlyInfra.step}
							formatValue={formatCurrency}
							onchange={(v) => appStore.updateAssumptions(id, { monthlyInfraCost: v })}
						/>
					{/if}

					<AssumptionSlider
						label="Dev hours (initial)"
						value={assumptions.devHoursInitial}
						min={SLIDER_RANGES.devHours.min} max={SLIDER_RANGES.devHours.max} step={SLIDER_RANGES.devHours.step}
						formatValue={(v) => v + 'h'}
						onchange={(v) => appStore.updateAssumptions(id, { devHoursInitial: v })}
					/>

					<AssumptionSlider
						label="Ops hours/mo"
						value={assumptions.opsHoursMonthly}
						min={SLIDER_RANGES.opsHours.min} max={SLIDER_RANGES.opsHours.max} step={SLIDER_RANGES.opsHours.step}
						formatValue={(v) => v + 'h'}
						onchange={(v) => appStore.updateAssumptions(id, { opsHoursMonthly: v })}
					/>
				</div>
			</div>
		{/each}
	</div>
</Panel>

<style>
	.assumptions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 1.5rem;
	}

	.method-assumptions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.method-name {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--tx);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--ui);
		margin: 0;
	}

	.assumption-fields {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
</style>
