<script lang="ts">
	import maplibregl from 'maplibre-gl';
	import { loadData } from '$lib/data/load';
	import { mapStore } from '$lib/map/MapStore.svelte';
	import { llm } from '$lib/llm/provider.svelte';
	import { LlmRun } from '$lib/llm/run.svelte';
	import OverlayPanel from '$lib/shell/OverlayPanel.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { Button } from '@wri-datalab/ui';
	import Panel from '$lib/ui/Panel.svelte';
	import { Select } from '@wri-datalab/ui';
	import Spinner from '$lib/ui/Spinner.svelte';
	import { EVENT_TYPE_LABELS, type ChangeEvent, type SavedRegion } from './types';

	let regions = $state.raw<SavedRegion[]>([]);
	let events = $state.raw<ChangeEvent[]>([]);
	let dataAnchor = $state<number>(Date.now()); // newest event time — "now" for the demo

	$effect(() => {
		loadData<{ regions: SavedRegion[] }>('saved-regions.json').then((d) => (regions = d.regions));
		loadData<{ events: ChangeEvent[] }>('change-events.json').then((d) => {
			events = d.events;
			dataAnchor = Math.max(...d.events.map((e) => Date.parse(e.timestamp)));
		});
	});

	// "Last visit" is simulated with a time-travel control so the probe is repeatable.
	let sinceDays = $state('3');
	const lastVisit = $derived(dataAnchor - Number(sinceDays) * 86400000);

	const fresh = $derived(
		events
			.filter((e) => Date.parse(e.timestamp) >= lastVisit)
			.sort((a, b) => b.severity - a.severity)
	);

	const regionName = (id: string) => regions.find((r) => r.id === id)?.name ?? id;

	// --- briefing ---
	const briefing = new LlmRun();
	let cited = $state<ChangeEvent[]>([]);

	function composeMockBriefing(list: ChangeEvent[]): string {
		if (!list.length)
			return 'All quiet: nothing changed in your saved regions since your last visit. The atlas will speak up when something does.';
		const top = list[0];
		const second = list[1];
		const rest = list.length - (second ? 2 : 1);
		let text = `Since your last visit, ${list.length} event${list.length > 1 ? 's' : ''} touched ${new Set(list.map((e) => e.regionId)).size} of your saved regions — the one that matters is the ${EVENT_TYPE_LABELS[top.type]} in ${regionName(top.regionId)}: ${top.title.toLowerCase()} [1].`;
		if (second) {
			text += ` Also worth a glance: ${second.title.toLowerCase()} in ${regionName(second.regionId)} [2]${rest > 0 ? `; the remaining ${rest} were routine [3]` : ''}.`;
		}
		return text;
	}

	function brief() {
		cited = fresh.slice(0, 3);
		const eventList = fresh
			.map(
				(e, i) =>
					`[${i + 1}] ${e.timestamp.slice(0, 10)} ${regionName(e.regionId)} · ${EVENT_TYPE_LABELS[e.type]} (sev ${e.severity}): ${e.title} — ${e.detail}`
			)
			.join('\n');
		briefing.run({
			system:
				'You write a two-sentence morning briefing for a map user about changes in their saved regions. ' +
				'Rank by severity; mention at most 2 events explicitly with inline citation markers like [1], [2] ' +
				'that refer to the numbered events provided. Summarize the rest as routine with [3] if any. No preamble.',
			messages: [
				{
					role: 'user',
					content: `Saved regions: ${regions.map((r) => r.name).join('; ')}.\nEvents since last visit:\n${eventList || '(none)'}`
				}
			],
			maxTokens: 250,
			mock: { kind: 'fn', run: () => composeMockBriefing(fresh) }
		});
	}

	// --- flyover verification ---
	let pulseMarker: maplibregl.Marker | null = null;

	function flyToEvent(e: ChangeEvent) {
		mapStore.flyTo({ center: e.location, zoom: e.zoom });
		if (pulseMarker) mapStore.scene.removeMarker(pulseMarker);
		const el = document.createElement('div');
		el.className = 'pulse-marker';
		pulseMarker = mapStore.scene.addMarker(
			new maplibregl.Marker({ element: el }).setLngLat(e.location)
		);
	}

	function citationTarget(n: number): ChangeEvent | null {
		return cited[n - 1] ?? null;
	}

	// split briefing text into text/citation tokens for tap-to-verify rendering
	const briefingTokens = $derived.by(() => {
		const out: { text?: string; cite?: number }[] = [];
		const re = /\[(\d+)\]/g;
		let lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = re.exec(briefing.content))) {
			if (m.index > lastIndex) out.push({ text: briefing.content.slice(lastIndex, m.index) });
			out.push({ cite: Number(m[1]) });
			lastIndex = re.lastIndex;
		}
		if (lastIndex < briefing.content.length) out.push({ text: briefing.content.slice(lastIndex) });
		return out;
	});

	// --- play-all tour ---
	let touring = $state(false);
	async function playAll() {
		touring = true;
		for (const e of cited) {
			if (!touring) break;
			flyToEvent(e);
			await new Promise((r) => setTimeout(r, 3200));
		}
		touring = false;
	}

	function frameRegion(r: SavedRegion) {
		mapStore.fitBounds([
			[r.bbox[0], r.bbox[1]],
			[r.bbox[2], r.bbox[3]]
		]);
	}
</script>

<OverlayPanel side="right" width="25rem" fill>
	<Panel title="Ambient briefing">
		{#snippet actions()}
			<Badge tone={llm.mode === 'mock' ? 'neutral' : 'primary'}>{llm.mode}</Badge>
		{/snippet}
		<p class="lead">
			Open the map and it tells you what changed since you last looked — in your regions, your
			layers, your language. Citations fly the camera to the evidence.
		</p>
		<div class="controls">
			<Select
				label="simulate last visit"
				bind:value={sinceDays}
				options={[
					{ value: '1', label: '1 day ago' },
					{ value: '3', label: '3 days ago' },
					{ value: '7', label: '1 week ago' },
					{ value: '30', label: '1 month ago' }
				]}
			/>
			<Button variant="primary" onclick={brief} disabled={briefing.isStreaming}>
				{#if briefing.isStreaming}<Spinner size={12} />{/if}
				brief me
			</Button>
		</div>
		<p class="meta-line">{fresh.length} events since then across your {regions.length} regions</p>

		{#if briefing.content}
			<div class="briefing">
				{#each briefingTokens as token, i (i)}
					{#if token.text !== undefined}{token.text}{:else if token.cite !== undefined}
						{@const target = citationTarget(token.cite)}
						{#if target}
							<button class="cite" onclick={() => flyToEvent(target)} title={target.title}>
								{token.cite}
							</button>
						{:else}<span class="cite dead">{token.cite}</span>{/if}
					{/if}
				{/each}
				{#if briefing.isStreaming}<span class="cursor"></span>{/if}
			</div>
			{#if cited.length && !briefing.isStreaming}
				<div class="tour-row">
					<Button size="sm" onclick={playAll} disabled={touring}>
						{touring ? 'touring…' : `play all (${cited.length} stops)`}
					</Button>
					{#if touring}<Button size="sm" variant="ghost" onclick={() => (touring = false)}>stop</Button>{/if}
				</div>
			{/if}
		{/if}
	</Panel>

	<Panel title="Saved regions" padded={false}>
		{#each regions as r (r.id)}
			{@const n = fresh.filter((e) => e.regionId === r.id).length}
			<button class="region" onclick={() => frameRegion(r)}>
				<span class="r-name">{r.name}</span>
				<span class="r-note">{r.note}</span>
				{#if n}<span class="r-count"><Badge tone="warning">{n} new</Badge></span>{/if}
			</button>
		{/each}
	</Panel>

	<Panel title="Event feed" padded={false}>
		{#if !fresh.length}
			<p class="empty">Nothing since the simulated last visit.</p>
		{:else}
			<ul class="feed">
				{#each fresh as e (e.id)}
					<li>
						<button class="ev" onclick={() => flyToEvent(e)}>
							<span class="ev-head">
								<Badge
									tone={e.severity > 0.7 ? 'error' : e.severity > 0.4 ? 'warning' : 'neutral'}
								>
									{EVENT_TYPE_LABELS[e.type]}
								</Badge>
								<span class="ev-when">{e.timestamp.slice(0, 10)}</span>
							</span>
							<span class="ev-title">{e.title}</span>
							<span class="ev-region">{regionName(e.regionId)}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</Panel>
</OverlayPanel>

<style>
	.lead {
		margin: 0 0 var(--space-3);
		font-size: 0.78rem;
		line-height: 1.55;
		color: var(--tx-2);
	}
	.controls {
		display: flex;
		gap: var(--space-2);
		align-items: flex-end;
	}
	.meta-line {
		margin: var(--space-2) 0 0;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-3);
	}
	.briefing {
		margin-top: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--ui);
		font-family: var(--font-body);
		font-size: var(--text-prose-size);
		line-height: 1.65;
		color: var(--tx);
	}
	.cite {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.15rem;
		height: 1.15rem;
		padding: 0 0.2rem;
		margin: 0 0.1rem;
		background: color-mix(in srgb, var(--primary) 15%, transparent);
		border: 1px solid var(--primary);
		border-radius: var(--radius-sm);
		color: var(--primary);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 600;
		cursor: pointer;
		vertical-align: baseline;
	}
	.cite:hover {
		background: var(--primary);
		color: var(--primary-content);
	}
	.cite.dead {
		opacity: 0.4;
		cursor: default;
	}
	.cursor {
		display: inline-block;
		width: 0.5em;
		height: 1em;
		background: var(--primary);
		animation: blink 1s steps(1) infinite;
		vertical-align: text-bottom;
	}
	@keyframes blink {
		50% {
			opacity: 0;
		}
	}
	.tour-row {
		margin-top: var(--space-3);
		display: flex;
		gap: var(--space-2);
	}
	.region {
		display: block;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		border-bottom: 1px solid var(--ui);
		padding: 0.5rem var(--space-3);
		cursor: pointer;
		position: relative;
	}
	.region:hover {
		background: var(--bg-3);
	}
	.r-name {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--tx);
	}
	.r-note {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-3);
		margin-top: 0.1rem;
	}
	.r-count {
		position: absolute;
		top: 0.5rem;
		right: var(--space-3);
	}
	.empty {
		padding: var(--space-3);
		margin: 0;
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		color: var(--tx-3);
	}
	.feed {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.ev {
		display: block;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		border-bottom: 1px solid var(--ui);
		padding: 0.45rem var(--space-3);
		cursor: pointer;
	}
	.ev:hover {
		background: var(--bg-3);
	}
	.ev-head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.ev-when {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-3);
	}
	.ev-title {
		display: block;
		font-size: 0.75rem;
		color: var(--tx);
		margin-top: 0.15rem;
	}
	.ev-region {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-3);
		margin-top: 0.05rem;
	}

	:global(.pulse-marker) {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--primary) 35%, transparent);
		border: 2px solid var(--primary);
		animation: pulse 1.4s ease-out infinite;
	}
	@keyframes pulse {
		0% {
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 55%, transparent);
		}
		100% {
			box-shadow: 0 0 0 22px transparent;
		}
	}
</style>
