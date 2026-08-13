<script lang="ts">
	import { page } from '$app/state';
	import { buildContextSnapshot, estimateTokens, serializeForPrompt } from '$lib/context/snapshot';
	import { reverseGeocode } from '$lib/map/geocode';
	import { mapStore } from '$lib/map/MapStore.svelte';
	import { llm } from '$lib/llm/provider.svelte';
	import { LlmRun } from '$lib/llm/run.svelte';
	import OverlayPanel from '$lib/shell/OverlayPanel.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { Button } from '@wri-datalab/ui';
	import Panel from '$lib/ui/Panel.svelte';
	import Spinner from '$lib/ui/Spinner.svelte';
	import { StreamingMarkdown as StreamedText } from '@wri-datalab/ui';
	import OvertureScene from '../shared/OvertureScene.svelte';
	import Section from './Section.svelte';

	let placeName = $state<string | null>(null);
	let tick = $state(0);

	// refresh place name when the (coarse) center moves
	$effect(() => {
		const [lon, lat] = mapStore.viewport.center;
		reverseGeocode([lon, lat]).then((n) => (placeName = n));
	});

	const snapshot = $derived.by(() => {
		// reactive deps: viewport sync, scene changes, manual refresh
		void mapStore.viewport;
		void mapStore.sceneVersion;
		void tick;
		return buildContextSnapshot(mapStore, {
			activeDemo: page.params.demo ?? '',
			llmMode: llm.mode,
			placeName
		});
	});

	const promptText = $derived(
		snapshot ? serializeForPrompt(snapshot, ['viewport', 'layers', 'environment', 'session']) : ''
	);

	const summary = new LlmRun();

	function summarize() {
		summary.run({
			system:
				'You are helping a designer review what contextual signals a web map app can feed an AI feature. ' +
				'Given a context snapshot, summarize in 3 short bullet points what an AI assistant would know, ' +
				'and 1 bullet on what is conspicuously missing.',
			messages: [{ role: 'user', content: promptText }],
			maxTokens: 400,
			mock: {
				kind: 'text',
				text:
					'- The assistant knows **where you are looking** (Cần Thơ at city scale) and exactly which layers are visible, including per-layer feature attributes.\n' +
					'- It knows the **rendering situation**: basemap, theme, viewport size — enough to reason about what is actually legible to you.\n' +
					'- It knows **session rhythm**: local time and last visit, enabling "what changed since" framing.\n' +
					'- Conspicuously missing: **user intent** — no task, role, or organization context; the app knows what you see but not why. (mock response)'
			}
		});
	}

	const ENRICHMENT = [
		['Reverse geocoding', 'place names for the viewport center (live, Nominatim)'],
		['Layer provenance', 'source, date, method, license per layer'],
		['User profile', 'role, organization, project, saved regions'],
		['Interaction history', 'recent cameras, queries, applied filters'],
		['Temporal context', 'season, local events, alert feeds for the area'],
		['Weather / hydrology', 'current + forecast conditions at the location'],
		['Device posture', 'bandwidth, battery, input modality'],
		['Collaboration', 'who else is viewing, annotations, shared cursors']
	];
</script>

<OvertureScene />

<OverlayPanel side="right" width="26rem" fill>
	<Panel title="Context telemetry" padded={false}>
		{#snippet actions()}
			<Badge tone="primary">~{estimateTokens(promptText)} tok</Badge>
			<Button size="sm" onclick={() => tick++}>refresh</Button>
		{/snippet}
		<div class="intro">
			Everything the app can currently tell a model — live. Move the map and watch it change. Each
			section is independently serializable, so a feature can spend its token budget deliberately.
		</div>
		{#if snapshot}
			<Section title="viewport" data={snapshot.viewport} open />
			<Section title="layers" data={snapshot.layers} open />
			<Section title="environment" data={snapshot.environment} />
			<Section title="session" data={snapshot.session} />
			<Section title="derived" data={snapshot.derived} />
			<Section title="prompt serialization" text={promptText} />
		{:else}
			<div class="loading"><Spinner /> waiting for map…</div>
		{/if}
	</Panel>

	<Panel title="Candidate enrichment sources">
		<p class="note">
			Signals not yet collected that could enrich AI context — the design-research payload of this
			probe.
		</p>
		<ul class="enrich">
			{#each ENRICHMENT as [name, desc] (name)}
				<li><strong>{name}</strong> — {desc}</li>
			{/each}
		</ul>
	</Panel>

	<Panel title="Summarize my context">
		{#snippet actions()}
			<Button size="sm" variant="primary" onclick={summarize} disabled={summary.isStreaming}>
				{#if summary.isStreaming}<Spinner size={11} />{/if}
				run
			</Button>
		{/snippet}
		{#if summary.error}
			<p class="error">{summary.error}</p>
		{:else if summary.content}
			<StreamedText content={summary.content} streaming={summary.isStreaming} />
		{:else}
			<p class="note">Sends the serialized snapshot to the model and asks what it knows.</p>
		{/if}
	</Panel>
</OverlayPanel>

<style>
	.intro {
		padding: var(--space-3);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		line-height: 1.5;
		color: var(--tx-2);
		border-bottom: 1px solid var(--ui);
	}
	.loading {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		padding: var(--space-3);
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		color: var(--tx-3);
	}
	.note {
		margin: 0 0 var(--space-2);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--tx-3);
		line-height: 1.5;
	}
	.enrich {
		margin: 0;
		padding-left: 1.1rem;
		font-size: 0.75rem;
		line-height: 1.6;
		color: var(--tx-2);
	}
	.enrich strong {
		color: var(--tx);
		font-weight: 600;
	}
	.error {
		color: var(--error-text);
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		margin: 0;
	}
</style>
