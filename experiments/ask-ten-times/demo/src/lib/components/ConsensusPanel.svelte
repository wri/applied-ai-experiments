<script lang="ts">
	import { Tabs, Markdown, JsonViewer, Badge } from '@wri-datalab/ui';
	import type { AnalysisResult } from '../state/trials.svelte';

	interface Props {
		analysis: AnalysisResult;
	}

	let { analysis }: Props = $props();

	let tab = $state('summary');
</script>

<Tabs
	items={[
		{ id: 'summary', label: 'Consensus' },
		{ id: 'json', label: 'JSON' },
	]}
	bind:active={tab}
	size="sm"
/>

{#if tab === 'summary'}
	<div class="consensus">
		<section>
			<h3>Recommended answer</h3>
			<Markdown content={analysis.recommended_answer} />
		</section>

		<section>
			<h3>Confidence assessment</h3>
			<p class="assessment">{analysis.confidence_assessment}</p>
		</section>

		<div class="point-columns">
			<section>
				<h3><Badge variant="success">stable</Badge></h3>
				<ul>
					{#each analysis.stable_points as point, i (i)}
						<li>{point}</li>
					{/each}
				</ul>
			</section>
			<section>
				<h3><Badge variant="warning">disputed</Badge></h3>
				<ul>
					{#each analysis.disputed_points as point, i (i)}
						<li>{point}</li>
					{:else}
						<li class="none">none found</li>
					{/each}
				</ul>
			</section>
			<section>
				<h3><Badge variant="info">rare but important</Badge></h3>
				<ul>
					{#each analysis.rare_but_important_points as point, i (i)}
						<li>{point}</li>
					{:else}
						<li class="none">none found</li>
					{/each}
				</ul>
			</section>
		</div>
	</div>
{:else}
	<JsonViewer data={analysis} initialExpandDepth={2} />
{/if}

<style>
	.consensus {
		display: flex;
		flex-direction: column;
		gap: var(--space-4, 1rem);
		margin-top: var(--space-3, 0.75rem);
	}

	h3 {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tx-2);
		margin: 0 0 var(--space-2, 0.5rem);
	}

	.assessment {
		margin: 0;
		font-size: 0.875rem;
	}

	.point-columns {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: var(--space-4, 1rem);
	}

	ul {
		margin: 0;
		padding-left: var(--space-4, 1rem);
		font-size: 0.85rem;
		display: flex;
		flex-direction: column;
		gap: var(--space-1, 0.25rem);
	}

	.none {
		color: var(--tx-2);
		list-style: none;
		margin-left: calc(-1 * var(--space-4, 1rem));
	}
</style>
