<script lang="ts">
	import { mapStore } from '$lib/map/MapStore.svelte';
	import { llm } from '$lib/llm/provider.svelte';
	import { StructuredOutputError, type StructuredAttempt } from '$lib/llm/structured';
	import { applyPatch, describeOp, semanticErrors, type AppliedPatch } from '$lib/style-patch/apply';
	import { ATTRIBUTES_PROMPT, STYLE_PATCH_SCHEMA, type StylePatch } from '$lib/style-patch/schema';
	import OverlayPanel from '$lib/shell/OverlayPanel.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { Button } from '@wri-datalab/ui';
	import Panel from '$lib/ui/Panel.svelte';
	import Spinner from '$lib/ui/Spinner.svelte';
	import { Textarea as TextArea } from '@wri-datalab/ui';
	import OvertureScene from '../shared/OvertureScene.svelte';
	import { styleMock, SUGGESTIONS } from './mocks';

	let prompt = $state('');
	let running = $state(false);
	let attempts = $state<StructuredAttempt[]>([]);
	let patch = $state<StylePatch | null>(null);
	let semErrors = $state<string[]>([]);
	let failure = $state<string | null>(null);
	let applied = $state<AppliedPatch[]>([]);

	async function run(text?: string) {
		const q = (text ?? prompt).trim();
		if (!q || running) return;
		prompt = q;
		running = true;
		attempts = [];
		patch = null;
		semErrors = [];
		failure = null;
		try {
			const result = await llm.structured<StylePatch>(
				{
					system:
						'You translate map-styling intent into a StylePatch for a Can Tho, Vietnam map built on real Overture Maps layers (land use, buildings, water, places) plus a modelled flood-risk overlay. ' +
						'Change only what the intent requires; prefer subtle, cartographically sound values.\n\n' +
						ATTRIBUTES_PROMPT,
					messages: [{ role: 'user', content: `Styling intent: ${q}` }],
					maxTokens: 900,
					mock: styleMock()
				},
				STYLE_PATCH_SCHEMA
			);
			attempts = result.attempts;
			semErrors = semanticErrors(result.value);
			patch = result.value;
		} catch (e) {
			if (e instanceof StructuredOutputError) {
				failure = `${e.message} Last errors: ${e.validationErrors.join('; ')}`;
			} else {
				failure = (e as Error).message;
			}
		} finally {
			running = false;
		}
	}

	function apply() {
		if (!patch || semErrors.length) return;
		applied = [...applied, applyPatch(mapStore.scene, patch)];
		patch = null;
		attempts = [];
	}

	function revertLast() {
		const last = applied.at(-1);
		if (!last) return;
		last.revert();
		applied = applied.slice(0, -1);
	}
</script>

<OvertureScene />

<OverlayPanel side="right" width="26rem" fill>
	<Panel title="Style from structured output">
		{#snippet actions()}
			<Badge tone={llm.mode === 'mock' ? 'neutral' : 'primary'}>{llm.mode}</Badge>
		{/snippet}
		<p class="lead">
			The model emits a constrained <code>StylePatch</code> — whitelisted ops, layers, and
			properties — never raw style JSON. Schema validation and semantic checks form the
			containment layer; broken output goes into a repair loop, never onto the map.
		</p>
		<TextArea bind:value={prompt} rows={2} placeholder="Describe how the map should look…" />
		<div class="row">
			<Button variant="primary" onclick={() => run()} disabled={running || !prompt.trim()}>
				{#if running}<Spinner size={12} />{/if}
				propose patch
			</Button>
			{#if applied.length}
				<Button onclick={revertLast}>revert ({applied.length})</Button>
			{/if}
		</div>
		<div class="chips">
			{#each SUGGESTIONS as s (s)}
				<button class="chip" onclick={() => run(s)} disabled={running}>{s}</button>
			{/each}
		</div>
	</Panel>

	{#if attempts.length || failure}
		<Panel title="Pipeline trace" padded={false}>
			{#each attempts as attempt, i (i)}
				<div class="attempt">
					<div class="attempt-head">
						<span class="attempt-n">attempt {i + 1}</span>
						{#if attempt.valid}
							<Badge tone="success">valid</Badge>
						{:else}
							<Badge tone="error">rejected</Badge>
						{/if}
					</div>
					{#if !attempt.valid}
						<ul class="errs">
							{#each attempt.errors as err (err)}<li>{err}</li>{/each}
						</ul>
						<div class="repair-note">→ repair turn sent with validation errors</div>
					{/if}
					<details>
						<summary>raw model output</summary>
						<pre>{attempt.raw}</pre>
					</details>
				</div>
			{/each}
			{#if failure}
				<div class="failure">{failure}</div>
			{/if}
		</Panel>
	{/if}

	{#if patch}
		<Panel title="Proposed patch">
			{#snippet actions()}
				<Button size="sm" variant="primary" onclick={apply} disabled={semErrors.length > 0}>
					apply
				</Button>
			{/snippet}
			<p class="rationale">{patch.rationale}</p>
			<ul class="ops">
				{#each patch.ops as op, i (i)}
					<li><code>{describeOp(op)}</code></li>
				{/each}
			</ul>
			{#if semErrors.length}
				<div class="sem">
					<div class="label">semantic check failed</div>
					<ul class="errs">
						{#each semErrors as err (err)}<li>{err}</li>{/each}
					</ul>
				</div>
			{/if}
		</Panel>
	{/if}

	{#if applied.length}
		<Panel title="Applied history">
			<ol class="history">
				{#each applied as a, i (i)}
					<li>{a.patch.rationale.slice(0, 80)}{a.patch.rationale.length > 80 ? '…' : ''}</li>
				{/each}
			</ol>
		</Panel>
	{/if}
</OverlayPanel>

<style>
	.lead {
		margin: 0 0 var(--space-3);
		font-size: 0.78rem;
		line-height: 1.55;
		color: var(--tx-2);
	}
	.lead code {
		font-family: var(--font-mono);
		color: var(--primary);
		font-size: 0.72rem;
	}
	.row {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
	.chips {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin-top: var(--space-3);
	}
	.chip {
		text-align: left;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--tx-2);
		background: var(--bg);
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		padding: 0.35rem 0.5rem;
		cursor: pointer;
	}
	.chip:hover:not(:disabled) {
		border-color: var(--primary);
		color: var(--tx);
	}
	.attempt {
		padding: var(--space-3);
		border-bottom: 1px solid var(--ui);
	}
	.attempt-head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.attempt-n {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		text-transform: uppercase;
		color: var(--tx-3);
	}
	.errs {
		margin: 0 0 var(--space-2);
		padding-left: 1.1rem;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--error-text);
		line-height: 1.5;
	}
	.repair-note {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--warning-text);
		margin-bottom: var(--space-2);
	}
	details summary {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-3);
		cursor: pointer;
	}
	details pre {
		margin: var(--space-2) 0 0;
		padding: var(--space-2);
		background: var(--bg);
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		font-size: 0.62rem;
		line-height: 1.45;
		overflow-x: auto;
		max-height: 12rem;
		overflow-y: auto;
	}
	.failure {
		padding: var(--space-3);
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		color: var(--error-text);
	}
	.rationale {
		margin: 0 0 var(--space-3);
		font-size: 0.78rem;
		line-height: 1.5;
		color: var(--tx);
	}
	.ops {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.ops code {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-2);
		background: var(--bg);
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		padding: 0.25rem 0.4rem;
		display: block;
		overflow-x: auto;
		white-space: nowrap;
	}
	.sem {
		margin-top: var(--space-3);
	}
	.history {
		margin: 0;
		padding-left: 1.2rem;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--tx-2);
		line-height: 1.6;
	}
</style>
