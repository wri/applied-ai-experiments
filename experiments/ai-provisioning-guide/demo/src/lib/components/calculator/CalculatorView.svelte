<script lang="ts">
	import { Panel } from '@wri-datalab/ui';
	import { appStore } from '$lib/stores/app.svelte.js';
	import { methods } from '$lib/data/methods.js';
	import { calculateTCOCurve, calculateCumulativeCurve } from '$lib/logic/tco.js';
	import { formatCurrency, formatCurrencyCompact, formatVolume, formatCostPerRequest } from '$lib/utils/format.js';
	import { ALLOWED_HORIZONS } from '$lib/utils/url.js';
	import type { MethodId } from '$lib/types.js';
	import PlotContainer from '../shared/PlotContainer.svelte';
	import VolumeInputs from './VolumeInputs.svelte';
	import AssumptionsPanel from './AssumptionsPanel.svelte';
	import InsightsPanel from './InsightsPanel.svelte';

	function toggle(id: MethodId) {
		appStore.toggleComparison(id);
	}

	const horizonOptions: { value: number; label: string }[] = [
		{ value: 1, label: '1 mo' },
		{ value: 3, label: '3 mo' },
		{ value: 6, label: '6 mo' },
		{ value: 12, label: '1 yr' },
		{ value: 24, label: '2 yr' },
		{ value: 36, label: '3 yr' },
	];

	const methodColors: Record<string, string> = {
		byok: '#6366f1',
		provider_direct: '#f59e0b',
		managed_router: '#10b981',
		self_built_proxy: '#ef4444',
		managed_inference: '#8b5cf6',
		full_self_hosted: '#06b6d4',
		edge_browser: '#ec4899',
		hybrid: '#78716c',
	};

	// -- Chart specs --

	// Stacked bar chart — monthly cost breakdown by category
	const barPlotFn = $derived.by(() => {
		const results = appStore.tcoResults;
		const numMethods = appStore.selectedMethods.length;

		const data = results.flatMap((tco) => {
			const name = methods.find((m) => m.id === tco.methodId)?.shortName ?? tco.methodId;
			return [
				{ method: name, category: 'Inference', cost: tco.breakdown.inference },
				{ method: name, category: 'Infrastructure', cost: tco.breakdown.infrastructure },
				{ method: name, category: 'Development', cost: tco.breakdown.development },
				{ method: name, category: 'Operations', cost: tco.breakdown.operations },
			];
		});

		return (Plot: any) => ({
			marginLeft: 90,
			marginRight: 20,
			height: Math.max(200, numMethods * 50),
			x: { label: 'Monthly Cost ($)', tickFormat: (v: number) => formatCurrencyCompact(v) },
			y: { label: null },
			color: {
				legend: true,
				domain: ['Inference', 'Infrastructure', 'Development', 'Operations'],
				range: ['#f59e0b', '#06b6d4', '#8b5cf6', '#ef4444'],
			},
			marks: [
				Plot.barX(data, Plot.stackX({
					x: 'cost',
					y: 'method',
					fill: 'category',
					sort: { y: '-x' },
					tip: {
						format: {
							x: (v: number) => formatCurrency(v),
							y: true,
							fill: true,
						},
					},
				})),
				Plot.ruleX([0]),
			],
		});
	});

	// Cumulative cost over time chart
	const cumulativePlotFn = $derived.by(() => {
		const selected = appStore.selectedMethods;
		const inputs = appStore.tcoInputs;
		const assumptions = appStore.assumptions;
		const horizon = appStore.timeHorizonMonths;
		const maxMonths = Math.max(horizon, 36);

		const curveData = calculateCumulativeCurve(selected, inputs, assumptions, maxMonths);
		const data = curveData.map((d) => ({
			...d,
			method: methods.find((m) => m.id === d.methodId)?.shortName ?? d.methodId,
		}));

		// Upfront-only points (month 0) for dot marks
		const upfrontData = data.filter((d) => d.month === 0);

		const colorDomain = selected.map(
			(id) => methods.find((m) => m.id === id)?.shortName ?? id,
		);
		const colorRange = selected.map((id) => methodColors[id] ?? '#999');

		return (Plot: any) => ({
			marginLeft: 70,
			marginRight: 20,
			height: 300,
			x: { label: 'Months', domain: [0, maxMonths] },
			y: { label: 'Cumulative Cost ($)', tickFormat: (v: number) => formatCurrencyCompact(v) },
			color: { legend: true, domain: colorDomain, range: colorRange },
			marks: [
				Plot.ruleX([horizon], { stroke: '#888', strokeDasharray: '4,4' }),
				Plot.line(data, { x: 'month', y: 'cumulative', stroke: 'method', strokeWidth: 2 }),
				Plot.dot(upfrontData, { x: 'month', y: 'cumulative', fill: 'method', r: 4, symbol: 'circle' }),
				Plot.tip(data, Plot.pointerX({
					x: 'month',
					y: 'cumulative',
					stroke: 'method',
					format: {
						x: (v: number) => `Month ${v}`,
						y: (v: number) => formatCurrency(v),
						stroke: true,
					},
				})),
			],
		});
	});

	// Line chart — cost curves across volume range
	const linePlotFn = $derived.by(() => {
		const selected = appStore.selectedMethods;
		const inputs = appStore.tcoInputs;
		const assumptions = appStore.assumptions;
		const currentVolume = inputs.monthlyVolume;

		const curveData = calculateTCOCurve(selected, inputs, assumptions);
		const data = curveData.map((d) => ({
			...d,
			method: methods.find((m) => m.id === d.methodId)?.shortName ?? d.methodId,
		}));

		const colorDomain = selected.map(
			(id) => methods.find((m) => m.id === id)?.shortName ?? id,
		);
		const colorRange = selected.map((id) => methodColors[id] ?? '#999');

		return (Plot: any) => ({
			marginLeft: 70,
			marginRight: 20,
			height: 300,
			x: { label: 'Monthly Volume', type: 'log', tickFormat: (v: number) => formatVolume(v) },
			y: { label: 'Monthly Cost ($)', tickFormat: (v: number) => formatCurrencyCompact(v) },
			color: { legend: true, domain: colorDomain, range: colorRange },
			marks: [
				Plot.ruleX([currentVolume], { stroke: '#888', strokeDasharray: '4,4' }),
				Plot.line(data, { x: 'volume', y: 'total', stroke: 'method', strokeWidth: 2 }),
				Plot.dot(data, { x: 'volume', y: 'total', fill: 'method', r: 2 }),
				Plot.tip(data, Plot.pointerX({
					x: 'volume',
					y: 'total',
					stroke: 'method',
					channels: {
						'Cost/req': {
							value: 'costPerRequest',
							label: 'Cost/req',
						},
					},
					format: {
						x: (v: number) => formatVolume(v) + ' req/mo',
						y: (v: number) => formatCurrency(v) + '/mo',
						'Cost/req': (v: number) => formatCostPerRequest(v),
						stroke: true,
					},
				})),
			],
		});
	});

	// Bar chart — cost per request comparison
	const perRequestPlotFn = $derived.by(() => {
		const results = appStore.tcoResults;
		const numMethods = appStore.selectedMethods.length;

		const data = results
			.map((tco) => ({
				method: methods.find((m) => m.id === tco.methodId)?.shortName ?? tco.methodId,
				costPerRequest: tco.costPerRequest,
				totalMonthly: tco.breakdown.total,
				methodId: tco.methodId,
			}))
			.sort((a, b) => a.costPerRequest - b.costPerRequest);

		return (Plot: any) => ({
			marginLeft: 90,
			marginRight: 20,
			height: Math.max(200, numMethods * 50),
			x: { label: 'Cost per Request ($)', tickFormat: (v: number) => '$' + v.toFixed(3) },
			y: { label: null },
			color: {
				domain: data.map((d) => d.method),
				range: data.map((d) => methodColors[d.methodId] ?? '#999'),
			},
			marks: [
				Plot.barX(data, {
					x: 'costPerRequest',
					y: 'method',
					fill: 'method',
					sort: { y: 'x' },
					channels: {
						'Monthly total': {
							value: 'totalMonthly',
							label: 'Monthly total',
						},
					},
					tip: {
						format: {
							x: (v: number) => formatCostPerRequest(v),
							y: true,
							fill: false,
							'Monthly total': (v: number) => formatCurrency(v),
						},
					},
				}),
				Plot.ruleX([0]),
			],
		});
	});
</script>

<div class="calculator-view">
	<!-- Method selection -->
	<div class="method-toggles">
		<span class="toggles-label">Methods:</span>
		{#each methods as method}
			{@const isSelected = appStore.selectedMethods.includes(method.id)}
			<button
				class="method-toggle"
				class:selected={isSelected}
				style={isSelected ? `border-color: ${methodColors[method.id]}; background: ${methodColors[method.id]}22` : ''}
				onclick={() => toggle(method.id)}
			>
				{method.shortName}
			</button>
		{/each}
	</div>

	<div class="calculator-layout">
		<!-- Left column: inputs -->
		<div class="calculator-inputs">
			<Panel title="Volume & Tokens">
				<VolumeInputs />
			</Panel>

			<AssumptionsPanel />
		</div>

		<!-- Right column: charts -->
		<div class="calculator-charts">
			{#if appStore.selectedMethods.length === 0}
				<Panel title="Charts">
					<p style="color: var(--tx-3); text-align: center; padding: 2rem;">
						Select at least one method to see cost estimates.
					</p>
				</Panel>
			{:else}
				<!-- Time horizon selector -->
				<div class="horizon-selector">
					<span class="toggles-label">Time horizon:</span>
					<div class="horizon-pills">
						{#each horizonOptions as opt}
							<button
								class="horizon-pill"
								class:active={appStore.timeHorizonMonths === opt.value}
								onclick={() => appStore.setTimeHorizon(opt.value)}
							>
								{opt.label}
							</button>
						{/each}
					</div>
				</div>

				<Panel title="Monthly Cost Breakdown">
					<PlotContainer plotFn={barPlotFn} />
				</Panel>

				<Panel title="Cumulative Cost Over Time">
					<PlotContainer plotFn={cumulativePlotFn} />
				</Panel>

				<Panel title="Cost at Scale">
					<PlotContainer plotFn={linePlotFn} />
				</Panel>

				<Panel title="Cost per Request">
					<PlotContainer plotFn={perRequestPlotFn} />
				</Panel>

				<!-- Summary table -->
				<Panel title="Summary">
					<div class="summary-table-wrapper">
						<table class="summary-table">
							<thead>
								<tr class="group-header">
									<th rowspan="2">Method</th>
									<th class="group-upfront">Upfront</th>
									<th colspan="4" class="group-recurring">Monthly Recurring</th>
									<th colspan="2" class="group-total">Total</th>
								</tr>
								<tr class="sub-header">
									<th class="group-upfront">Setup</th>
									<th class="group-recurring">Inference</th>
									<th class="group-recurring">Infra</th>
									<th class="group-recurring">Ops</th>
									<th class="group-recurring">Sum</th>
									<th class="group-total">{appStore.timeHorizonMonths}-mo</th>
									<th class="group-total">$/Req</th>
								</tr>
							</thead>
							<tbody>
								{#each appStore.tcoResultsExpanded.toSorted((a, b) => a.expanded.periodTotal - b.expanded.periodTotal) as tco}
									{@const name = methods.find((m) => m.id === tco.methodId)?.shortName ?? tco.methodId}
									<tr>
										<td class="method-cell">
											<span class="color-dot" style="background: {methodColors[tco.methodId]}"></span>
											{name}
										</td>
										<td class="col-upfront">{formatCurrency(tco.expanded.upfront)}</td>
										<td class="col-recurring">{formatCurrency(tco.expanded.monthlyInference)}</td>
										<td class="col-recurring">{formatCurrency(tco.expanded.monthlyInfrastructure)}</td>
										<td class="col-recurring">{formatCurrency(tco.expanded.monthlyOperations)}</td>
										<td class="col-recurring">{formatCurrency(tco.expanded.monthlyRecurring)}</td>
										<td class="total-cell">{formatCurrency(tco.expanded.periodTotal)}</td>
										<td>{formatCostPerRequest(tco.costPerRequest)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</Panel>

				<InsightsPanel />
			{/if}
		</div>
	</div>
</div>

<style>
	.calculator-view {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
	}

	.method-toggles {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.toggles-label {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tx-3);
	}

	.method-toggle {
		padding: 0.375rem 0.75rem;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		background: var(--bg-2);
		color: var(--tx-2);
		border: 1px solid var(--ui);
		border-radius: var(--radius-full);
		cursor: pointer;
		transition: all 150ms ease;
	}

	.method-toggle:hover {
		border-color: var(--ui-2);
		color: var(--tx);
	}

	.method-toggle.selected {
		color: var(--tx);
		font-weight: 500;
	}

	/* Time horizon selector */
	.horizon-selector {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.horizon-pills {
		display: flex;
		gap: 0;
		border: 1px solid var(--ui);
		border-radius: var(--radius-full);
		overflow: hidden;
	}

	.horizon-pill {
		padding: 0.3rem 0.625rem;
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		background: var(--bg-2);
		color: var(--tx-3);
		border: none;
		border-right: 1px solid var(--ui);
		cursor: pointer;
		transition: all 150ms ease;
	}

	.horizon-pill:last-child {
		border-right: none;
	}

	.horizon-pill:hover {
		color: var(--tx);
		background: var(--bg-3);
	}

	.horizon-pill.active {
		background: var(--accent);
		color: var(--bg);
		font-weight: 600;
	}

	.calculator-layout {
		display: grid;
		grid-template-columns: 1fr 2fr;
		gap: 1rem;
		align-items: start;
	}

	@media (max-width: 640px) {
		.calculator-layout {
			grid-template-columns: 1fr;
		}

		.calculator-inputs {
			position: static;
		}
	}

	.calculator-inputs {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
		position: static;
		top: 1rem;
	}

	.calculator-charts {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
	}

	.summary-table-wrapper {
		overflow-x: auto;
		min-width: 0;
	}

	.summary-table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}

	.summary-table th {
		text-align: right;
		padding: 0.375rem 0.75rem;
		color: var(--tx-3);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 1px solid var(--ui);
	}

	.summary-table th:first-child {
		text-align: left;
	}

	/* Group header row styling */
	.group-header th {
		font-size: 0.625rem;
		padding-bottom: 0.125rem;
		border-bottom: none;
	}

	.sub-header th {
		font-size: 0.6875rem;
		padding-top: 0.125rem;
	}

	/* Column group visual separation */
	.group-upfront {
		background: color-mix(in srgb, var(--bg-2) 50%, transparent);
		border-left: 2px solid var(--ui);
	}

	.group-recurring {
		background: color-mix(in srgb, var(--bg-3) 30%, transparent);
	}

	.group-total {
		background: color-mix(in srgb, var(--bg-2) 50%, transparent);
		border-left: 2px solid var(--ui);
	}

	.col-upfront {
		background: color-mix(in srgb, var(--bg-2) 50%, transparent);
		border-left: 2px solid var(--ui);
	}

	.col-recurring {
		background: color-mix(in srgb, var(--bg-3) 30%, transparent);
	}

	.summary-table td {
		text-align: right;
		padding: 0.5rem 0.75rem;
		color: var(--tx);
		border-bottom: 1px solid var(--ui);
		font-variant-numeric: tabular-nums;
	}

	.summary-table td:first-child {
		text-align: left;
	}

	.method-cell {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.color-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.total-cell {
		font-weight: 600;
		border-left: 2px solid var(--ui);
	}

	@media (max-width: 640px) {
		.method-toggles {
			gap: 0.375rem;
		}

		.summary-table th,
		.summary-table td {
			padding: 0.375rem 0.5rem;
		}

		.horizon-selector {
			flex-wrap: wrap;
		}
	}
</style>
