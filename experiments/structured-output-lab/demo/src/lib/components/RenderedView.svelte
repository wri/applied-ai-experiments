<script lang="ts">
	import { JsonViewer, Card } from '@wri-datalab/ui';

	interface Props {
		data: unknown;
	}

	let { data }: Props = $props();

	function isRecord(value: unknown): value is Record<string, unknown> {
		return value !== null && typeof value === 'object' && !Array.isArray(value);
	}

	function isObjectArray(value: unknown): value is Record<string, unknown>[] {
		return Array.isArray(value) && value.length > 0 && value.every(isRecord);
	}

	function columnsOf(rows: Record<string, unknown>[]): string[] {
		const cols: string[] = [];
		for (const row of rows) {
			for (const key of Object.keys(row)) {
				if (!cols.includes(key)) cols.push(key);
			}
		}
		return cols;
	}

	function cellText(value: unknown): string {
		if (value === null || value === undefined) return '—';
		if (typeof value === 'object') return JSON.stringify(value);
		return String(value);
	}

	const entries = $derived(isRecord(data) ? Object.entries(data) : []);
</script>

{#snippet table(rows: Record<string, unknown>[])}
	<div class="rendered-table-wrap">
		<table class="rendered-table">
			<thead>
				<tr>
					{#each columnsOf(rows) as col (col)}
						<th>{col}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each rows as row, i (i)}
					<tr>
						{#each columnsOf(rows) as col (col)}
							<td>{cellText(row[col])}</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/snippet}

{#if isObjectArray(data)}
	{@render table(data)}
{:else if isRecord(data)}
	<div class="rendered-cards">
		{#each entries as [key, value] (key)}
			<Card padding="sm">
				<h3 class="rendered-key">{key}</h3>
				{#if isObjectArray(value)}
					{@render table(value)}
				{:else if Array.isArray(value)}
					<ul class="rendered-list">
						{#each value as item, i (i)}
							<li>{cellText(item)}</li>
						{/each}
					</ul>
				{:else}
					<p class="rendered-value">{cellText(value)}</p>
				{/if}
			</Card>
		{/each}
	</div>
{:else}
	<JsonViewer {data} initialExpandDepth={2} />
{/if}

<style>
	.rendered-cards {
		display: flex;
		flex-direction: column;
		gap: var(--space-3, 0.75rem);
	}

	.rendered-key {
		margin: 0 0 var(--space-2, 0.5rem);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--tx-2);
	}

	.rendered-value {
		margin: 0;
		font-size: 0.9rem;
	}

	.rendered-list {
		margin: 0;
		padding-left: var(--space-4, 1rem);
		font-size: 0.9rem;
	}

	.rendered-table-wrap {
		overflow-x: auto;
	}

	.rendered-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
	}

	.rendered-table th,
	.rendered-table td {
		text-align: left;
		padding: var(--space-2, 0.5rem);
		border-bottom: 1px solid var(--ui, #333);
		vertical-align: top;
	}

	.rendered-table th {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tx-2);
	}
</style>
