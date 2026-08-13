<script lang="ts">
	interface Claim {
		text: string;
		present_in_runs: number[];
	}

	interface Props {
		claims: Claim[];
		runCount: number;
		oncellclick?: (runIndex: number) => void;
	}

	let { claims, runCount, oncellclick }: Props = $props();

	const sorted = $derived(
		[...claims].sort((a, b) => b.present_in_runs.length - a.present_in_runs.length)
	);
</script>

<div class="heatmap-wrap">
	<table class="heatmap">
		<thead>
			<tr>
				<th class="claim-col">Claim</th>
				{#each Array.from({ length: runCount }) as _, i (i)}
					<th class="run-col">R{i + 1}</th>
				{/each}
				<th class="count-col">n</th>
			</tr>
		</thead>
		<tbody>
			{#each sorted as claim, row (row)}
				<tr>
					<td class="claim-col" title={claim.text}>{claim.text}</td>
					{#each Array.from({ length: runCount }) as _, i (i)}
						{@const present = claim.present_in_runs.includes(i + 1)}
						<td class="run-col">
							{#if present}
								<button
									type="button"
									class="cell present"
									title="Present in run {i + 1} — click to view"
									aria-label="Claim present in run {i + 1}"
									onclick={() => oncellclick?.(i)}
								></button>
							{:else}
								<span class="cell absent"></span>
							{/if}
						</td>
					{/each}
					<td class="count-col">{claim.present_in_runs.length}/{runCount}</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<p class="heatmap-caption">
		Presence judged by a second LLM pass over the run outputs — open the analysis inspector to
		see the exact prompt.
	</p>
</div>

<style>
	.heatmap-wrap {
		overflow-x: auto;
	}

	.heatmap {
		border-collapse: collapse;
		width: 100%;
		font-size: 0.8rem;
	}

	.heatmap th {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--tx-2);
		padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
		text-align: left;
	}

	.heatmap td {
		padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
		border-top: 1px solid var(--ui, #333);
		vertical-align: middle;
	}

	.claim-col {
		max-width: 24rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.run-col {
		text-align: center;
		width: 2rem;
	}

	.count-col {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--tx-2);
		white-space: nowrap;
	}

	.cell {
		display: inline-block;
		width: 0.9rem;
		height: 0.9rem;
		border-radius: var(--radius-sm, 3px);
	}

	.cell.present {
		background: var(--accent, #d97706);
		border: none;
		cursor: pointer;
		padding: 0;
	}

	.cell.present:hover {
		outline: 2px solid var(--tx);
	}

	.cell.absent {
		background: var(--bg-2);
		border: 1px solid var(--ui, #333);
	}

	.heatmap-caption {
		font-size: 0.7rem;
		color: var(--tx-2);
		margin-top: var(--space-2, 0.5rem);
	}
</style>
