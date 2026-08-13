<script lang="ts">
	// =========================================================================
	// Golden-path BYOK demo: one prompt → one streamed model response, with cost
	// forecasting, token/latency metrics, a request inspector, and (via the
	// layout's <SessionTelemetry/>) cost + energy/carbon telemetry — all for free.
	//
	// This is a working starting point. Replace the prompt UI and the single
	// `run` slot with whatever your experiment actually does; the wiring
	// (stores, model selection, telemetry, SEO) is already in place.
	// =========================================================================
	import {
		DemoLayout,
		Panel,
		Button,
		Textarea,
		ModelSelector,
		TokenCounter,
		LatencyBadge,
		StreamingMarkdown,
		EmptyState,
		Modal
	} from '@wri-datalab/ui';
	import { modelSelectorConfigForDemo } from '@wri-datalab/llm-lab/models';
	import {
		createLLMRun,
		RequestInspector,
		SessionTelemetryTrigger,
		estimateCost,
		formatUsd
	} from '@wri-datalab/llm-lab';
	import type { ProviderId } from '@byo-keys/core';
	import { stores } from '$lib/stores';
	import { SLUG } from '$lib/slug';

	// One reactive call slot wired to runLLM (streaming content, abort, usage).
	const run = createLLMRun(stores);

	let providerId = $state<ProviderId>('anthropic');
	let modelId = $state('');
	let system = $state('You are a concise, helpful assistant.');
	let prompt = $state('Explain what a "bring-your-own-key" demo is, in two sentences.');
	let inspectorOpen = $state(false);

	// Cheap pre-run cost forecast (clearly an estimate; not sent to the model).
	const preflight = $derived.by(() => {
		if (!modelId || !prompt.trim()) return null;
		const model = stores
			.getClient()
			.getModels(providerId)
			.find((m) => m.id === modelId);
		return estimateCost(model, `${system}\n${prompt}`, 600);
	});

	async function handleRun() {
		if (!modelId || !prompt.trim()) return;
		await run.run({
			providerId,
			model: modelId,
			system: system.trim() || undefined,
			messages: [{ role: 'user', content: prompt }]
		});
	}

	// Example global action for the header (see headerActions snippet below).
	function resetPrompt() {
		system = 'You are a concise, helpful assistant.';
		prompt = 'Explain what a "bring-your-own-key" demo is, in two sentences.';
	}
</script>

<DemoLayout
	title="CHANGEME: Prototype Title"
	subtitle="CHANGEME: one-line subtitle"
	description="CHANGEME: what this prototype demonstrates."
	{stores}
	providers={['anthropic', 'openai', 'gemini']}
	maxWidth="lg"
>
	<!--
	  Header slots (see DESIGN.md §4 "Navigation header slots"):
	  • headerActions — GLOBAL demo actions (reset, export, compare), sentence-case
	    labels. API-key and theme controls are already rendered by DemoLayout;
	    don't duplicate them. SessionTelemetryTrigger goes last (pairs with
	    trigger="none" on the layout's SessionTelemetry).
	  • headerNav — in-demo navigation BETWEEN sub-views via HeaderNav. Add it
	    only when the demo has more than one view; commented out below as a pattern.
	-->
	{#snippet headerActions()}
		<Button variant="ghost" size="sm" onclick={resetPrompt}>Reset</Button>
		<SessionTelemetryTrigger />
	{/snippet}

	<!-- {#snippet headerNav()}
		<HeaderNav
			items={[
				{ id: 'run', label: 'Run', onclick: () => (view = 'run') },
				{ id: 'about', label: 'About', onclick: () => (view = 'about') }
			]}
			active={view}
		/>
	{/snippet} -->

	<div class="grid">
		<Panel title="Prompt">
			<Textarea bind:value={system} label="System prompt" minRows={2} maxRows={6} />
			<Textarea bind:value={prompt} label="User prompt" minRows={6} maxRows={20} />
			<div class="run-row">
				<ModelSelector
					{stores}
					config={modelSelectorConfigForDemo(SLUG)}
					bind:providerId
					bind:modelId
				/>
				{#if run.isStreaming}
					<Button variant="danger" onclick={() => run.abort()}>Cancel</Button>
				{:else}
					<Button variant="primary" disabled={!modelId || !prompt.trim()} onclick={handleRun}>
						Run
					</Button>
				{/if}
			</div>
			{#if preflight}
				<p class="estimate">
					~{preflight.inputTokens} input tokens
					{#if preflight.usd !== null}· est. {formatUsd(preflight.usd)}{/if}
				</p>
			{/if}
		</Panel>

		<Panel title="Output">
			{#snippet actions()}
				{#if run.request}
					<Button variant="ghost" size="sm" onclick={() => (inspectorOpen = true)}>
						Inspect call
					</Button>
				{/if}
			{/snippet}

			{#if run.error}
				<p class="error">{run.error}</p>
			{:else if run.content || run.isStreaming}
				<StreamingMarkdown content={run.content} streaming={run.isStreaming} />
				{#if run.usage && !run.isStreaming}
					<div class="metrics">
						<TokenCounter
							tokens={{ input: run.usage.inputTokens, output: run.usage.outputTokens }}
							showBreakdown
							size="sm"
						/>
						<LatencyBadge ms={run.latencyMs} size="sm" />
					</div>
				{/if}
			{:else}
				<EmptyState
					title="No output yet"
					description="Add your API key (top-right settings), pick a model, then Run."
				/>
			{/if}
		</Panel>
	</div>
</DemoLayout>

<Modal bind:open={inspectorOpen} title="Request inspector" size="lg">
	{#if run.request}
		<RequestInspector
			request={run.request}
			responses={[
				{
					content: run.content,
					usage: run.usage ?? undefined,
					latencyMs: run.latencyMs,
					error: run.error ?? undefined
				}
			]}
		/>
	{/if}
</Modal>

<style>
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4, 1rem);
		align-items: start;
		max-width: 64rem;
		margin: 0 auto;
		padding: var(--space-4, 1rem);
	}

	@media (max-width: 900px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}

	.run-row {
		display: flex;
		align-items: center;
		gap: var(--space-3, 0.75rem);
		margin-top: var(--space-3, 0.75rem);
		flex-wrap: wrap;
	}

	.estimate {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--tx-2);
		margin: var(--space-2, 0.5rem) 0 0;
	}

	.metrics {
		display: flex;
		align-items: center;
		gap: var(--space-3, 0.75rem);
		margin-top: var(--space-3, 0.75rem);
	}

	.error {
		color: var(--error, #b91c1c);
		font-family: var(--font-mono);
		font-size: 0.8rem;
	}
</style>
