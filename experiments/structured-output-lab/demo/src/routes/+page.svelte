<script lang="ts">
	import {
		DemoLayout,
		Panel,
		Button,
		Select,
		Textarea,
		Tabs,
		Modal,
		JsonViewer,
		ModelSelector,
		TokenCounter,
		LatencyBadge,
		Badge,
		toast,
		hubHomeHref,
	} from '@wri-datalab/ui';
	import { base } from '$app/paths';
	import { modelSelectorConfigForDemo } from '@wri-datalab/llm-lab/models';
	import {
		RequestInspector,
		HistoryPanel,
		ReplayBanner,
		SessionTelemetryTrigger,
		createDemoMode,
		estimateCost,
		formatUsd,
		downloadJson,
		downloadCsv,
		type ReplaySession,
	} from '@wri-datalab/llm-lab';
	import type { ProviderId } from '@byo-keys/core';
	import { stores } from '$lib/stores';
	import { SAMPLES } from '$lib/sample-data';
	import { createLab } from '$lib/state/lab.svelte';
	import replaySessionData from '$lib/replay/session.json';
	import SchemaPanel from '$lib/components/SchemaPanel.svelte';
	import ValidationTrace from '$lib/components/ValidationTrace.svelte';
	import RenderedView from '$lib/components/RenderedView.svelte';

	const lab = createLab(stores);
	const replaySession = replaySessionData as unknown as ReplaySession;

	let providerId = $state<ProviderId>('anthropic');
	let modelId = $state('');

	// Header live/mock badge. Reactive to key changes, unlike a bare
	// canRunLive() read — see createDemoMode in @wri-datalab/llm-lab.
	const demoMode = createDemoMode(stores, () => providerId, () => modelId);
	let sampleId = $state(SAMPLES[0].id);
	let outputTab = $state('json');
	let inspectorOpen = $state(false);
	let historyPanel = $state<HistoryPanel | null>(null);

	const ready = $derived(modelId !== '' && lab.schemaState.schema !== null);

	const preflight = $derived.by(() => {
		const schema = lab.schemaState.schema;
		if (!schema || !modelId) return null;
		const model = stores
			.getClient()
			.getModels(providerId)
			.find((m) => m.id === modelId);
		return estimateCost(model, JSON.stringify(schema) + lab.sourceText, 1024);
	});

	function loadSample(id: string) {
		const sample = SAMPLES.find((s) => s.id === id);
		if (sample) lab.sourceText = sample.text;
	}

	async function handleRun() {
		await lab.run(providerId, modelId);
		outputTab = lab.valid ? 'rendered' : 'validation';
		historyPanel?.refresh();
	}

	// Hands-free playback of the recorded extraction (keyless visitors).
	function playReplay() {
		const first = replaySession.calls[0]?.request;
		if (!first) return;
		void (async () => {
			await lab.run(first.providerId, first.model);
			outputTab = lab.valid ? 'rendered' : 'validation';
			historyPanel?.refresh();
		})();
	}

	async function handleRepair() {
		await lab.repair(providerId, modelId);
		if (lab.valid) {
			toast.success('Repair succeeded — output now conforms to the schema');
			outputTab = 'rendered';
		}
		historyPanel?.refresh();
	}

	function firstObjectArray(data: unknown): Record<string, unknown>[] | null {
		if (Array.isArray(data) && data.every((r) => r !== null && typeof r === 'object')) {
			return data as Record<string, unknown>[];
		}
		if (data !== null && typeof data === 'object') {
			for (const value of Object.values(data)) {
				if (
					Array.isArray(value) &&
					value.length > 0 &&
					value.every((r) => r !== null && typeof r === 'object' && !Array.isArray(r))
				) {
					return value as Record<string, unknown>[];
				}
			}
		}
		return null;
	}

	const csvRows = $derived(lab.valid ? firstObjectArray(lab.parsed) : null);
</script>

<DemoLayout
	title="Structured Output Lab"
	homeHref={hubHomeHref(base)}
	{stores}
	providers={['anthropic', 'openai', 'gemini']}
	maxWidth="full"
	mode={demoMode.mode}
	modeLabel={demoMode.label}
>
	{#snippet headerActions()}
		<SessionTelemetryTrigger />
	{/snippet}

	<div class="replay-slot">
		<ReplayBanner
			{stores}
			session={replaySession}
			onPlay={playReplay}
			restoreConfig={(c) => lab.restoreConfig(c)}
		/>
	</div>

	<div class="lab-grid">
		<Panel title="1 · Messy input">
			<Select
				label="Sample"
				bind:value={sampleId}
				options={SAMPLES.map((s) => ({ value: s.id, label: s.name }))}
				onchange={loadSample}
			/>
			<Textarea bind:value={lab.sourceText} label="Source text" minRows={18} maxRows={28} />
		</Panel>

		<Panel title="2 · Schema">
			<SchemaPanel {lab} />
		</Panel>

		<Panel title="3 · Validated output">
			<div class="run-bar">
				<ModelSelector {stores} config={modelSelectorConfigForDemo('structured-output-lab')} bind:providerId bind:modelId />
				<Button variant="primary" loading={lab.running} disabled={!ready} onclick={handleRun}>
					Run extraction
				</Button>
				{#if preflight}
					<span class="estimate">
						est. ~{preflight.inputTokens.toLocaleString()} input tokens
						{#if preflight.usd !== null}
							· {formatUsd(preflight.usd)}{/if}
					</span>
				{/if}
			</div>

			{#if lab.running}
				<pre class="streaming">{lab.streamingContent || 'Waiting for the model…'}</pre>
			{:else if lab.hasRun}
				<Tabs
					items={[
						{ id: 'json', label: 'JSON' },
						{ id: 'validation', label: `Validation${lab.valid ? '' : ` (${lab.issues.length})`}` },
						{ id: 'rendered', label: 'Rendered' },
					]}
					bind:active={outputTab}
					size="sm"
				/>

				{#if lab.runError}
					<p class="run-error">{lab.runError}</p>
				{:else if outputTab === 'json'}
					<JsonViewer data={lab.parsed ?? lab.rawJson} initialExpandDepth={3} />
				{:else if outputTab === 'validation'}
					<ValidationTrace
						valid={lab.valid}
						issues={lab.issues}
						hasRun={lab.hasRun}
						canRepair={lab.canRepair}
						repairing={lab.running}
						repairCount={lab.repairCount}
						onrepair={handleRepair}
					/>
				{:else if outputTab === 'rendered'}
					{#if lab.valid}
						<RenderedView data={lab.parsed} />
					{:else}
						<p class="trace-hint">Output failed validation — see the Validation tab.</p>
					{/if}
				{/if}

				<div class="result-meta">
					{#if lab.valid}
						<Badge variant="success">valid</Badge>
					{:else}
						<Badge variant="error">invalid</Badge>
					{/if}
					<TokenCounter
						tokens={{ input: lab.totalUsage.inputTokens, output: lab.totalUsage.outputTokens }}
						showBreakdown
						size="sm"
					/>
					<LatencyBadge ms={lab.totalLatencyMs} size="sm" />
					{#if lab.costUsd !== null}
						<span class="estimate">actual {formatUsd(lab.costUsd)}</span>
					{/if}
					<Button variant="ghost" size="sm" onclick={() => (inspectorOpen = true)}>
						Inspect requests
					</Button>
				</div>

				<div class="export-bar">
					<Button
						variant="secondary"
						size="sm"
						disabled={lab.parsed === undefined}
						onclick={() => downloadJson(lab.parsed, 'structured-output')}
					>
						Export JSON
					</Button>
					<Button
						variant="secondary"
						size="sm"
						disabled={!csvRows}
						onclick={() => csvRows && downloadCsv(csvRows, 'structured-output')}
					>
						Export CSV
					</Button>
				</div>
			{:else}
				<p class="trace-hint">
					Pick a model, choose a schema, and run extraction. The point of this lab: failures are
					visible, explainable, and repairable.
				</p>
			{/if}
		</Panel>
	</div>

	<HistoryPanel bind:this={historyPanel} history={lab.history} onrestore={(r) => lab.restore(r)} />
</DemoLayout>

<Modal bind:open={inspectorOpen} title="Request inspector" size="lg">
	{#each lab.attempts as attempt, i (i)}
		<div class="inspector-attempt">
			<h3 class="inspector-label">{attempt.label}</h3>
			<RequestInspector request={attempt.request} responses={[attempt.response]} />
		</div>
	{/each}
</Modal>

<style>
	.replay-slot {
		margin-bottom: var(--space-4, 1rem);
	}

	.lab-grid {
		display: grid;
		grid-template-columns: 1fr 1fr 1.2fr;
		gap: var(--space-4, 1rem);
		align-items: start;
		margin-bottom: var(--space-4, 1rem);
	}

	@media (max-width: 1100px) {
		.lab-grid {
			grid-template-columns: 1fr;
		}
	}

	.run-bar {
		display: flex;
		align-items: center;
		gap: var(--space-3, 0.75rem);
		flex-wrap: wrap;
		margin-bottom: var(--space-3, 0.75rem);
	}

	.estimate {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--tx-2);
	}

	.streaming {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 24rem;
		overflow-y: auto;
		background: var(--bg-2);
		padding: var(--space-3, 0.75rem);
		border-radius: var(--radius-md, 6px);
	}

	.run-error {
		color: var(--error, #b91c1c);
		font-family: var(--font-mono);
		font-size: 0.8rem;
	}

	.trace-hint {
		color: var(--tx-2);
		font-size: 0.875rem;
	}

	.result-meta {
		display: flex;
		align-items: center;
		gap: var(--space-3, 0.75rem);
		flex-wrap: wrap;
		margin-top: var(--space-4, 1rem);
		padding-top: var(--space-3, 0.75rem);
		border-top: 1px solid var(--ui, #333);
	}

	.export-bar {
		display: flex;
		gap: var(--space-2, 0.5rem);
		margin-top: var(--space-3, 0.75rem);
	}

	.inspector-attempt {
		margin-bottom: var(--space-5, 1.25rem);
	}

	.inspector-label {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tx-2);
		margin: 0 0 var(--space-2, 0.5rem);
	}
</style>
