<script lang="ts">
	import { commands } from '$lib/commands/registry.svelte';
	import { mapStore } from '$lib/map/MapStore.svelte';
	import OverlayPanel from '$lib/shell/OverlayPanel.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { Button } from '@wri-datalab/ui';
	import Kbd from '$lib/ui/Kbd.svelte';
	import Panel from '$lib/ui/Panel.svelte';
	import OvertureScene from '../shared/OvertureScene.svelte';
	import { FLOOD_COLORS, type InteractiveLayerId } from '../shared/canTho';
	import type { FilterSpecification } from 'maplibre-gl';

	// Demo-scoped state the commands manipulate — proof that per-demo commands
	// can drive demo-local behavior through the shared registry.
	let filters = $state<Partial<Record<InteractiveLayerId, FilterSpecification | null>>>({});
	let activeFilterLabel = $state<string | null>(null);

	$effect(() => {
		return commands.registerDemo([
			{
				id: 'demo:filter-very-high',
				title: 'Isolate very-high flood band (modelled)',
				hint: 'demo-scoped command',
				section: 'Demo',
				keywords: 'flood filter risk band',
				run: ({ closePalette }) => {
					closePalette();
					filters = {
						'flood-zones': ['==', ['get', 'flood_risk'], 'very_high'],
						'flood-zones-outline': ['==', ['get', 'flood_risk'], 'very_high']
					};
					activeFilterLabel = 'flood_risk = very_high';
				}
			},
			{
				id: 'demo:filter-farmland',
				title: 'Show only farmland (Overture land use)',
				hint: 'demo-scoped command',
				section: 'Demo',
				keywords: 'farmland agriculture land use filter',
				run: ({ closePalette }) => {
					closePalette();
					filters = {
						'landuse-fill': ['==', ['get', 'class'], 'farmland'],
						'landuse-outline': ['==', ['get', 'class'], 'farmland']
					};
					activeFilterLabel = 'land_use class = farmland';
				}
			},
			{
				id: 'demo:clear-filter',
				title: 'Clear layer filters',
				section: 'Demo',
				keywords: 'reset show all',
				run: ({ closePalette }) => {
					closePalette();
					filters = {
						'flood-zones': null,
						'flood-zones-outline': null,
						'landuse-fill': null,
						'landuse-outline': null
					};
					activeFilterLabel = null;
				}
			},
			{
				id: 'demo:frame-study-area',
				title: 'Frame the study area',
				section: 'Demo',
				keywords: 'zoom fit extent',
				run: ({ closePalette }) => {
					closePalette();
					mapStore.fitBounds([
						[105.55, 9.89],
						[105.95, 10.19]
					]);
				}
			}
		]);
	});

	const EXAMPLES: [string, string][] = [
		['isolate', 'match a demo-scoped command'],
		['fly to hanoi', 'parameterized command — geocodes and flies'],
		['satellite', 'global map command'],
		['what am I looking at?', 'no command matches → becomes an AI question with full context'],
		['is flooding a concern here', 'AI question, seeded mock answer']
	];
</script>

<OvertureScene {filters} />

<OverlayPanel side="right" width="24rem">
	<Panel title="Command palette">
		{#snippet actions()}
			{#if activeFilterLabel}<Badge tone="warning">{activeFilterLabel}</Badge>{/if}
		{/snippet}
		<p class="lead">
			Press <Kbd>⌘K</Kbd> anywhere in the app. One input mixes three kinds of actions — registered
			commands, parameterized commands, and an AI fallback that receives the full context
			snapshot when nothing matches.
		</p>
		<Button variant="primary" onclick={() => (commands.paletteOpen = true)}>open palette</Button>

		<div class="label try">Things to type</div>
		<ul class="examples">
			{#each EXAMPLES as [text, note] (text)}
				<li>
					<code>{text}</code>
					<span>{note}</span>
				</li>
			{/each}
		</ul>

		<div class="label try">Design notes</div>
		<ul class="notes">
			<li>Demo pages contribute commands to the same registry the app uses; they unregister on demo switch.</li>
			<li>The AI row is always last and always visible when text doesn't match — the palette degrades into a question box instead of a dead end.</li>
			<li>The mode badge on the AI row shows whether the answer will be mock or live.</li>
		</ul>
	</Panel>

	<Panel title="Action log" padded={false}>
		{#if commands.log.length === 0}
			<p class="empty">Nothing run yet — commands executed via the palette land here.</p>
		{:else}
			<ul class="log">
				{#each commands.log as entry, i (i)}
					<li>
						<span class="time">{entry.at}</span>
						<span class="cmd">{entry.title}</span>
						{#if entry.input}<span class="input">{entry.input}</span>{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</Panel>
</OverlayPanel>

<div class="legend-chip">
	{#each Object.entries(FLOOD_COLORS) as [k, color] (k)}
		<span class="chip"><i style:background={color}></i>{k.replace('_', ' ')}</span>
	{/each}
	<span class="chip layer-id">flood-zones · modelled</span>
</div>

<style>
	.lead {
		margin: 0 0 var(--space-3);
		font-size: 0.78rem;
		line-height: 1.55;
		color: var(--tx-2);
	}
	.try {
		margin: var(--space-4) 0 var(--space-2);
	}
	.examples {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.examples li {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.examples code {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--primary);
	}
	.examples span {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-3);
	}
	.notes {
		margin: 0;
		padding-left: 1rem;
		font-size: 0.72rem;
		line-height: 1.55;
		color: var(--tx-2);
	}
	.empty {
		margin: 0;
		padding: var(--space-3);
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		color: var(--tx-3);
	}
	.log {
		list-style: none;
		margin: 0;
		padding: var(--space-2) 0;
		max-height: 12rem;
		overflow-y: auto;
	}
	.log li {
		display: flex;
		gap: var(--space-2);
		align-items: baseline;
		padding: 0.2rem var(--space-3);
		font-family: var(--font-mono);
		font-size: 0.68rem;
	}
	.time {
		color: var(--tx-3);
		flex: none;
	}
	.cmd {
		color: var(--tx);
	}
	.input {
		color: var(--primary);
	}

	.legend-chip {
		position: absolute;
		bottom: var(--space-6);
		left: var(--space-4);
		z-index: 20;
		display: flex;
		gap: var(--space-2);
		background: color-mix(in srgb, var(--bg) 85%, transparent);
		border: 1px solid var(--ui);
		border-radius: var(--radius-md);
		padding: 0.3rem 0.6rem;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-2);
	}
	.chip i {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		display: inline-block;
	}
	.layer-id {
		color: var(--tx-3);
	}
</style>
