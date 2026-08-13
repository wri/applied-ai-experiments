<script lang="ts">
	import {
		DemoLayout,
		Panel,
		Button,
		Input,
		Select,
		Modal,
		ModelSelector,
		EmptyState,
		Alert,
		Spinner,
		TokenCounter,
		toast,
	} from '@wri-datalab/ui';
	import { modelSelectorConfigForDemo } from '@wri-datalab/llm-lab/models';
	import {
		RequestInspector,
		HistoryPanel,
		SessionTelemetryTrigger,
		createDemoMode,
		estimateCost,
		formatUsd,
		downloadJson,
		downloadSvg,
		downloadPng,
	} from '@wri-datalab/llm-lab';
	import type { ProviderId } from '@byo-keys/core';
	import { stores } from '$lib/stores';
	import { MAP_STYLES, getMapStyle } from '$lib/prompts/map-styles';
	import { createMapState } from '$lib/state/map.svelte';
	import GraphCanvas from '$lib/components/GraphCanvas.svelte';
	import NodePanel from '$lib/components/NodePanel.svelte';

	const PRESET_TOPIC =
		'Map the relationship between methane mitigation, food systems, livestock policy, finance mechanisms, and national climate commitments';

	const map = createMapState(stores);

	let providerId = $state<ProviderId>('anthropic');
	let modelId = $state('');
	let inspectorOpen = $state(false);
	let historyPanel = $state<HistoryPanel | null>(null);
	let canvas = $state<GraphCanvas | null>(null);

	// Mirrors the gate runLLM applies, so the badge can't disagree with reality.
	// Header live/mock badge. Reactive to key changes, unlike a bare
	// canRunLive() read — see createDemoMode in @wri-datalab/llm-lab.
	const demoMode = createDemoMode(stores, () => providerId, () => modelId);
	const mockMode = $derived(demoMode.mode === 'mock');

	const currentStyle = $derived(getMapStyle(map.styleId));

	const preflight = $derived.by(() => {
		if (!modelId) return null;
		const model = stores
			.getClient()
			.getModels(providerId)
			.find((m) => m.id === modelId);
		return estimateCost(model, currentStyle.systemPrompt + map.topic, 2500);
	});

	async function handleGenerate() {
		await map.generate(providerId, modelId);
		historyPanel?.refresh();
	}

	async function handleExpand(nodeId: string) {
		await map.expand(providerId, modelId, nodeId);
		historyPanel?.refresh();
	}

	function svgBackground(): string {
		const svg = canvas?.getSvg();
		if (!svg) return '#ffffff';
		const bg = getComputedStyle(svg).getPropertyValue('--bg').trim();
		return bg || '#ffffff';
	}

	function exportSvg() {
		const svg = canvas?.getSvg();
		if (!svg) return;
		downloadSvg(svg, 'concept-map');
	}

	async function exportPng() {
		const svg = canvas?.getSvg();
		if (!svg) return;
		try {
			await downloadPng(svg, 'concept-map', { scale: 2, background: svgBackground() });
		} catch (error) {
			toast.error(`PNG export failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	function exportJson() {
		downloadJson(
			{
				topic: map.topic,
				style: map.styleId,
				nodes: $state.snapshot(map.nodes),
				edges: $state.snapshot(map.edges),
			},
			'concept-map'
		);
	}
</script>

<DemoLayout
	title="Concept Map Generator"
	{stores}
	providers={['anthropic', 'openai', 'gemini']}
	maxWidth="full"
	mode={demoMode.mode}
	modeLabel={demoMode.label}
>
	{#snippet headerActions()}
		<SessionTelemetryTrigger />
	{/snippet}

	{#if mockMode}
		<div class="mock-slot">
			<Alert variant="info">
				<strong>Keyless mode.</strong> No API key, so graph data comes from a committed fixture
				instead of a model — validated against the same schema and integrity checks as live
				output. The preset topic has a full hand-written map; <strong>expanding any node still
				works</strong>, because the new nodes are computed from whichever node you click. Nothing
				is spent, so no cost is reported. Add a key in settings to map any topic for real.
			</Alert>
		</div>
	{/if}

	<Panel title="Map console">
		<div class="topic-row">
			<div class="topic-input">
				<Input bind:value={map.topic} label="Topic" placeholder="What should the map cover?" />
			</div>
			<Button variant="secondary" size="sm" onclick={() => (map.topic = PRESET_TOPIC)}>
				Try: methane × food systems
			</Button>
		</div>

		<div class="controls">
			<div class="control">
				<Select
					label="Map style"
					bind:value={map.styleId}
					options={MAP_STYLES.map((style) => ({ value: style.id, label: style.name }))}
					hint={currentStyle.description}
				/>
			</div>
			<ModelSelector {stores} config={modelSelectorConfigForDemo('concept-map')} bind:providerId bind:modelId />
		</div>

		<div class="run-row">
			{#if map.busy}
				<span class="phase">
					<Spinner />
					{map.phase === 'generating' ? 'generating map…' : 'expanding node…'}
				</span>
			{:else}
				<Button variant="primary" disabled={!modelId || !map.topic.trim()} onclick={handleGenerate}>
					Generate map
				</Button>
				{#if preflight}
					<span class="estimate">
						~{preflight.inputTokens.toLocaleString()} input tokens
						{#if preflight.usd !== null}
							· est. {formatUsd(preflight.usd)}{/if}
					</span>
				{/if}
			{/if}
			{#if map.lastRequest}
				<Button variant="ghost" size="sm" onclick={() => (inspectorOpen = true)}>
					Inspect last call
				</Button>
			{/if}
		</div>
	</Panel>

	{#if map.error}
		<Alert variant="error">{map.error}</Alert>
	{/if}

	{#if map.nodes.length > 0}
		<div class="export-bar">
			<Button variant="ghost" size="sm" onclick={exportSvg}>Export SVG</Button>
			<Button variant="ghost" size="sm" onclick={exportPng}>Export PNG</Button>
			<Button variant="ghost" size="sm" onclick={exportJson}>Export JSON</Button>
			<span class="run-meta">
				<TokenCounter
					tokens={{ input: map.totalUsage.inputTokens, output: map.totalUsage.outputTokens }}
					showBreakdown
					size="sm"
				/>
				{#if map.mocked}
					<span class="estimate">no spend (mock)</span>
				{:else if map.totalCostUsd > 0}
					<span class="estimate">actual {formatUsd(map.totalCostUsd)}</span>
				{/if}
			</span>
		</div>

		<div class="map-area" class:with-panel={map.selectedNode !== null}>
			<div class="canvas-cell">
				<GraphCanvas
					bind:this={canvas}
					nodes={map.nodes}
					edges={map.edges}
					selectedId={map.selectedNodeId}
					onselect={(id) => map.select(id)}
				/>
			</div>
			{#if map.selectedNode}
				<div class="side-cell">
					<NodePanel
						node={map.selectedNode}
						nodes={map.nodes}
						edges={map.edges}
						expanding={map.phase === 'expanding'}
						onexpand={handleExpand}
						onselect={(id) => map.select(id)}
					/>
				</div>
			{/if}
		</div>
	{:else if !map.busy}
		<EmptyState
			title="No map yet"
			description="Give a topic, pick a map style, and generate. The model returns nodes and edges as schema-validated JSON; a deterministic force layout draws the map. Click any node for details and expand it to grow the graph."
		/>
	{/if}

	<HistoryPanel bind:this={historyPanel} history={map.history} onrestore={(r) => map.restore(r)} />
</DemoLayout>

<Modal bind:open={inspectorOpen} title="Last request" size="lg">
	{#if map.lastRequest}
		<RequestInspector
			request={map.lastRequest}
			responses={[{ content: map.lastRaw, latencyMs: 0 }]}
		/>
	{/if}
</Modal>

<style>
	.mock-slot {
		margin-bottom: var(--space-4, 1rem);
	}

	.topic-row {
		display: flex;
		align-items: flex-end;
		gap: var(--space-3, 0.75rem);
		flex-wrap: wrap;
	}

	.topic-input {
		flex: 1;
		min-width: 18rem;
	}

	.controls {
		display: flex;
		align-items: flex-end;
		gap: var(--space-5, 1.25rem);
		flex-wrap: wrap;
		margin-top: var(--space-4, 1rem);
	}

	.control {
		min-width: 14rem;
	}

	.run-row {
		display: flex;
		align-items: center;
		gap: var(--space-3, 0.75rem);
		margin-top: var(--space-4, 1rem);
		flex-wrap: wrap;
	}

	.phase {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2, 0.5rem);
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--tx-2);
	}

	.estimate {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--tx-2);
	}

	.export-bar {
		display: flex;
		align-items: center;
		gap: var(--space-2, 0.5rem);
		flex-wrap: wrap;
		margin: var(--space-4, 1rem) 0 var(--space-2, 0.5rem);
	}

	.run-meta {
		display: inline-flex;
		align-items: center;
		gap: var(--space-3, 0.75rem);
		margin-left: auto;
	}

	.map-area {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-4, 1rem);
		margin-bottom: var(--space-4, 1rem);
	}

	.map-area.with-panel {
		grid-template-columns: minmax(0, 1fr) 22rem;
	}

	.canvas-cell {
		min-width: 0;
	}

	.side-cell {
		min-width: 0;
	}

	@media (max-width: 56rem) {
		.map-area.with-panel {
			grid-template-columns: 1fr;
		}
	}
</style>
