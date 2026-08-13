<script lang="ts">
	import { Panel } from '@wri-datalab/ui';
	import { methods } from '$lib/data/methods.js';
	import { defaultAssumptions, SHARED_RATES } from '$lib/data/defaults.js';
	import { formatCurrency } from '$lib/utils/format.js';

	let collapsed = $state(true);

	// Read-only view of the shipped default assumptions for every method —
	// the single source of truth in src/lib/data/defaults.ts. The Assumptions
	// panel above lets you override these per method for selected methods.
	const rows = methods.map((m) => ({
		shortName: m.shortName,
		a: defaultAssumptions[m.id],
	}));

	const dash = '—';
	const price = (v: number) => (v > 0 ? '$' + v : dash);
	const pct = (v: number) => (v > 0 ? v + '%' : dash);
	const money = (v: number) => (v > 0 ? formatCurrency(v) : dash);
	const hours = (v: number) => v + 'h';
</script>

<Panel title="Default assumptions reference" collapsible bind:collapsed>
	<p class="intro">
		Starting cost-model assumptions for every method. These are the defaults the
		calculator loads with; adjust per-method values in the Assumptions panel above.
	</p>

	<div class="ref-table-wrapper">
		<table class="ref-table">
			<thead>
				<tr>
					<th>Method</th>
					<th>Input $/M</th>
					<th>Output $/M</th>
					<th>Markup</th>
					<th>Infra/mo</th>
					<th>Dev hrs</th>
					<th>Ops hrs/mo</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as { shortName, a }}
					<tr>
						<td class="method-cell">{shortName}</td>
						<td>{price(a.inputTokenPricePerMillion)}</td>
						<td>{price(a.outputTokenPricePerMillion)}</td>
						<td>{pct(a.routerMarkupPercent)}</td>
						<td>{money(a.monthlyInfraCost)}</td>
						<td>{hours(a.devHoursInitial)}</td>
						<td>{hours(a.opsHoursMonthly)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<p class="footnote">
		Dev labor {formatCurrency(SHARED_RATES.devHourlyRate)}/h · Ops labor
		{formatCurrency(SHARED_RATES.opsHourlyRate)}/h · upfront dev amortized over
		{SHARED_RATES.amortizationMonths} months.
	</p>
</Panel>

<style>
	.intro {
		margin: 0 0 1rem;
		font-size: 0.8125rem;
		color: var(--tx-2);
		line-height: 1.5;
	}

	.ref-table-wrapper {
		overflow-x: auto;
		min-width: 0;
	}

	.ref-table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}

	.ref-table th {
		text-align: right;
		padding: 0.375rem 0.75rem;
		color: var(--tx-3);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 1px solid var(--ui);
		white-space: nowrap;
	}

	.ref-table th:first-child {
		text-align: left;
	}

	.ref-table td {
		text-align: right;
		padding: 0.5rem 0.75rem;
		color: var(--tx);
		border-bottom: 1px solid var(--ui);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.ref-table tr:last-child td {
		border-bottom: none;
	}

	.method-cell {
		text-align: left !important;
		color: var(--tx);
		font-weight: 500;
	}

	.footnote {
		margin: 0.75rem 0 0;
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		color: var(--tx-3);
		line-height: 1.5;
	}
</style>
