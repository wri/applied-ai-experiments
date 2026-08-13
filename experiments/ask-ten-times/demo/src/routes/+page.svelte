<script lang="ts">
	import {
		DemoLayout,
		Panel,
		Button,
		Select,
		Textarea,
		Slider,
		Toggle,
		Modal,
		ModelSelector,
		TokenCounter,
		Badge,
		Spinner,
		CodeBlock,
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
		isReplayActive,
		estimateCost,
		formatUsd,
		downloadMarkdown,
		type ReplaySession,
	} from '@wri-datalab/llm-lab';
	import type { ProviderId } from '@byo-keys/core';
	import { stores } from '$lib/stores';
	import { SAMPLE_QUESTIONS } from '$lib/sample-data';
	import { createTrialsState, type Trial } from '$lib/state/trials.svelte';
	import replaySessionData from '$lib/replay/session.json';
	import RunCard from '$lib/components/RunCard.svelte';
	import ClaimHeatmap from '$lib/components/ClaimHeatmap.svelte';
	import ConsensusPanel from '$lib/components/ConsensusPanel.svelte';

	const lab = createTrialsState(stores);
	const replaySession = replaySessionData as unknown as ReplaySession;

	let providerId = $state<ProviderId>('anthropic');
	let modelId = $state('');

	// Header live/mock badge. Reactive to key changes, unlike a bare
	// canRunLive() read — see createDemoMode in @wri-datalab/llm-lab.
	const demoMode = createDemoMode(stores, () => providerId, () => modelId);

	// This demo has no MockSpec — nothing resolves a call without either a key or an
	// active recording, so a keyless Run would fall through to the network and error.
	const canRun = $derived(demoMode.mode === 'live' || isReplayActive());

	let sampleId = $state(SAMPLE_QUESTIONS[0].id);

	// One-way sync: the dropdown follows the question, never the reverse (onchange
	// already writes the other direction via loadSample). Without this the Select
	// keeps showing a stale preset after replay's restoreConfig rewrites the
	// question, or after the visitor edits the textarea by hand. An empty id falls
	// through to the Select's placeholder, which is the honest "no preset" state.
	$effect(() => {
		const match = SAMPLE_QUESTIONS.find((s) => s.text === lab.question)?.id ?? '';
		if (match !== sampleId) sampleId = match;
	});

	let inspectorOpen = $state(false);
	let inspectedTrial = $state<Trial | null>(null);
	let analysisInspectorOpen = $state(false);
	let highlightedRun = $state<number | null>(null);
	let historyPanel = $state<HistoryPanel | null>(null);

	const preflight = $derived.by(() => {
		if (!modelId) return null;
		const model = stores
			.getClient()
			.getModels(providerId)
			.find((m) => m.id === modelId);
		const single = estimateCost(model, lab.question, 600);
		const analysisInput = lab.question + 'x'.repeat(lab.n * 1500);
		const analysisEstimate = estimateCost(model, analysisInput, 1500);
		const usd =
			single.usd === null || analysisEstimate.usd === null
				? null
				: single.usd * lab.n + analysisEstimate.usd;
		return { calls: lab.n + 1 + (lab.paraphrase ? 1 : 0), usd };
	});

	function loadSample(id: string) {
		const sample = SAMPLE_QUESTIONS.find((s) => s.id === id);
		if (sample) lab.question = sample.text;
	}

	async function handleRun() {
		highlightedRun = null;
		await lab.run(providerId, modelId);
		historyPanel?.refresh();
	}

	// Hands-free playback of the recorded variance run (keyless visitors).
	function playReplay() {
		const first = replaySession.calls[0]?.request;
		if (!first) return;
		highlightedRun = null;
		void (async () => {
			await lab.run(first.providerId, first.model);
			historyPanel?.refresh();
		})();
	}

	function inspectTrial(trial: Trial) {
		inspectedTrial = trial;
		inspectorOpen = true;
	}

	function jumpToRun(index: number) {
		highlightedRun = index;
		document.getElementById(`run-card-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}
</script>

<DemoLayout
	title="Ask the Same Question 10 Times"
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

	<Panel title="Experiment console">
		<Select
			label="Preset question"
			bind:value={sampleId}
			placeholder="Custom question"
			options={SAMPLE_QUESTIONS.map((s) => ({ value: s.id, label: s.name }))}
			onchange={loadSample}
		/>
		<Textarea bind:value={lab.question} label="Question" minRows={3} maxRows={8} />

		<div class="controls">
			<ModelSelector {stores} config={modelSelectorConfigForDemo('ask-ten-times')} bind:providerId bind:modelId />
			<div class="control">
				<Slider bind:value={lab.n} min={3} max={15} step={1} label="Trials" />
			</div>
			<div class="control">
				<Slider
					bind:value={lab.temperature}
					min={0}
					max={1.5}
					step={0.1}
					label="Temperature"
					formatValue={(v) => v.toFixed(1)}
				/>
			</div>
			<Toggle bind:checked={lab.paraphrase} label="Paraphrase each trial" />
		</div>

		<div class="run-row">
			{#if lab.busy}
				<Button variant="danger" onclick={() => lab.cancel()}>Cancel</Button>
				<span class="phase">
					<Spinner />
					{#if lab.phase === 'paraphrasing'}generating paraphrases…
					{:else if lab.phase === 'running'}{lab.completedCount}/{lab.trials.length} trials complete
					{:else if lab.phase === 'analyzing'}analyzing variability…{/if}
				</span>
			{:else}
				<Button variant="primary" disabled={!modelId || !canRun} onclick={handleRun}>
					Run {lab.n} trials
				</Button>
				{#if !canRun}
					<span class="estimate">
						Add an API key to run live — or play the example session above.
					</span>
				{:else if preflight}
					<span class="estimate">
						{preflight.calls} calls
						{#if preflight.usd !== null}
							· est. {formatUsd(preflight.usd)}{/if}
					</span>
				{/if}
			{/if}
		</div>
	</Panel>

	{#if lab.trials.length > 0}
		<div class="run-grid">
			{#each lab.trials as trial (trial.index)}
				<RunCard {trial} highlighted={highlightedRun === trial.index} oninspect={inspectTrial} />
			{/each}
		</div>
	{/if}

	{#if lab.phase === 'done' || lab.analysis || lab.analysisError}
		<Panel title="Variability analysis">
			{#snippet actions()}
				{#if lab.analysisRequest}
					<Button variant="ghost" size="sm" onclick={() => (analysisInspectorOpen = true)}>
						Inspect analysis call
					</Button>
				{/if}
				<Button
					variant="ghost"
					size="sm"
					disabled={!lab.analysis}
					onclick={() => downloadMarkdown(lab.buildMarkdownReport(), 'ask-ten-times-report')}
				>
					Export report
				</Button>
			{/snippet}

			{#if lab.analysisError}
				<p class="analysis-error">{lab.analysisError}</p>
				{#if lab.analysisRaw}
					<CodeBlock code={lab.analysisRaw} language="json" maxHeight="16rem" />
				{/if}
			{:else if lab.analysis}
				<h3 class="section-label">Claim × run heatmap</h3>
				<ClaimHeatmap
					claims={lab.analysis.claims}
					runCount={lab.trials.length}
					oncellclick={jumpToRun}
				/>
				<div class="divider"></div>
				<ConsensusPanel analysis={lab.analysis} />
			{/if}

			<div class="result-meta">
				<TokenCounter
					tokens={{ input: lab.totalUsage.inputTokens, output: lab.totalUsage.outputTokens }}
					showBreakdown
					size="sm"
				/>
				{#if lab.costUsd !== null}
					<span class="estimate">actual {formatUsd(lab.costUsd)} (trials only)</span>
				{/if}
				<Badge>{lab.trials.filter((t) => t.status === 'error').length} failed</Badge>
			</div>
		</Panel>
	{/if}

	<HistoryPanel bind:this={historyPanel} history={lab.history} onrestore={(r) => lab.restore(r)} />
</DemoLayout>

<Modal bind:open={inspectorOpen} title="Trial request" size="lg">
	{#if inspectedTrial?.request}
		<RequestInspector
			request={inspectedTrial.request}
			responses={[
				{
					content: inspectedTrial.content,
					usage: inspectedTrial.usage,
					latencyMs: inspectedTrial.latencyMs,
					error: inspectedTrial.error,
				},
			]}
		/>
	{/if}
</Modal>

<Modal bind:open={analysisInspectorOpen} title="Analysis request" size="lg">
	{#if lab.analysisRequest}
		<RequestInspector
			request={lab.analysisRequest}
			responses={[{ content: lab.analysisRaw, latencyMs: 0 }]}
		/>
	{/if}
</Modal>

<style>
	.replay-slot {
		margin-bottom: var(--space-4, 1rem);
	}

	.controls {
		display: flex;
		align-items: flex-end;
		gap: var(--space-5, 1.25rem);
		flex-wrap: wrap;
		margin-top: var(--space-4, 1rem);
	}

	.control {
		min-width: 12rem;
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

	.run-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
		gap: var(--space-3, 0.75rem);
		margin: var(--space-4, 1rem) 0;
	}

	.section-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tx-2);
		margin: 0 0 var(--space-2, 0.5rem);
	}

	.divider {
		border-top: 1px solid var(--ui, #333);
		margin: var(--space-4, 1rem) 0;
	}

	.analysis-error {
		color: var(--error, #b91c1c);
		font-family: var(--font-mono);
		font-size: 0.8rem;
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
</style>
