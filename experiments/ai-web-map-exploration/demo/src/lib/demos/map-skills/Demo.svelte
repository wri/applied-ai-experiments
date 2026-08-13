<script lang="ts">
	import { marked } from 'marked';
	import { llm } from '$lib/llm/provider.svelte';
	import { StructuredOutputError } from '$lib/llm/structured';
	import OverlayPanel from '$lib/shell/OverlayPanel.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { Button } from '@wri-datalab/ui';
	import Panel from '$lib/ui/Panel.svelte';
	import Spinner from '$lib/ui/Spinner.svelte';
	import { Input as TextInput } from '@wri-datalab/ui';
	import OvertureScene from '../shared/OvertureScene.svelte';
	import { planMock, routerMock, SUGGESTED_TASKS } from './mocks';
	import { PlanRunner, PLAN_SCHEMA, type Plan } from './runner.svelte';
	import { loadSkills, type Skill } from './skills';

	let skills = $state.raw<Skill[]>([]);
	let viewing = $state<Skill | null>(null);

	$effect(() => {
		loadSkills().then((s) => (skills = s));
	});

	let task = $state('');
	let phase = $state<'idle' | 'routing' | 'planning'>('idle');
	let routedSkill = $state<{ skill: Skill; reason: string } | null>(null);
	let error = $state<string | null>(null);

	const runner = new PlanRunner();

	$effect(() => {
		return () => runner.stop();
	});

	async function go(text?: string) {
		const q = (text ?? task).trim();
		if (!q || phase !== 'idle') return;
		task = q;
		error = null;
		routedSkill = null;
		runner.load({ steps: [] });

		try {
			// 1) route: pick a skill from descriptions/triggers only
			phase = 'routing';
			const route = await llm.structured<{ skill: string; reason: string }>(
				{
					system:
						'Pick the single best skill for the task. Available skills:\n' +
						skills.map((s) => `- ${s.name}: ${s.description} (triggers: ${s.triggers.join(', ')})`).join('\n'),
					messages: [{ role: 'user', content: `Task: ${q}` }],
					maxTokens: 200,
					mock: routerMock()
				},
				{
					type: 'object',
					required: ['skill', 'reason'],
					additionalProperties: false,
					properties: {
						skill: { enum: skills.map((s) => s.name) },
						reason: { type: 'string', maxLength: 200 }
					}
				}
			);
			const skill = skills.find((s) => s.name === route.value.skill)!;
			routedSkill = { skill, reason: route.value.reason };

			// 2) plan: skill markdown injected as system context
			phase = 'planning';
			const plan = await llm.structured<Plan>(
				{
					system:
						`You plan map operations by following this skill EXACTLY:\n\n${skill.raw}\n\n` +
						'Produce a step plan using only tools: flyTo {center:[lon,lat], zoom}, ' +
						'setFilter {layer, filter (MapLibre expression)}, toggleLayer {layer, visible}, ' +
						'highlight {center:[lon,lat]}, report {text}. ' +
						'The map shows real Overture Maps layers for Can Tho (105.55-105.95, 9.9-10.19) plus a MODELLED flood overlay. ' +
						'Layers: landuse-fill/landuse-outline (real land use; attrs class, subtype — classes incl. farmland, orchard, aquaculture, residential, industrial), ' +
						'buildings-fill, water-fill, water-line, flood-zones/flood-zones-outline (modelled; attr flood_risk low|medium|high|very_high), ' +
						'places-dots (real places; attrs basic_category, confidence, name). ' +
						'Each step needs a narration sentence.',
					messages: [{ role: 'user', content: `Task: ${q}` }],
					maxTokens: 1400,
					mock: planMock()
				},
				PLAN_SCHEMA
			);
			runner.load(plan.value);
			phase = 'idle';
			runner.run();
		} catch (e) {
			phase = 'idle';
			error =
				e instanceof StructuredOutputError
					? `Planning failed: ${e.validationErrors.join('; ')}`
					: (e as Error).message;
		}
	}
</script>

<OvertureScene />

<OverlayPanel side="right" width="26rem" fill>
	<Panel title="Map skills">
		{#snippet actions()}
			<Badge tone={llm.mode === 'mock' ? 'neutral' : 'primary'}>{llm.mode}</Badge>
		{/snippet}
		<p class="lead">
			Skills are <code>skill.md</code> workflow files — triggers, tool whitelist, procedure,
			constraints. A router picks one for the task, the skill text becomes the model's operating
			manual, and the resulting step plan executes on the map.
		</p>
		<form
			onsubmit={(e) => {
				e.preventDefault();
				go();
			}}
		>
			<TextInput bind:value={task} placeholder="What should the map do?" />
			<div class="row">
				<Button variant="primary" type="submit" disabled={phase !== 'idle' || !task.trim()}>
					{#if phase !== 'idle'}<Spinner size={12} />{/if}
					{phase === 'routing' ? 'routing…' : phase === 'planning' ? 'planning…' : 'run task'}
				</Button>
				{#if runner.running}
					<Button onclick={() => (runner.paused = !runner.paused)}>
						{runner.paused ? 'resume' : 'pause'}
					</Button>
					<Button variant="ghost" onclick={() => runner.stop()}>stop</Button>
				{/if}
			</div>
		</form>
		<div class="chips">
			{#each SUGGESTED_TASKS as s (s)}
				<button class="chip" onclick={() => go(s)} disabled={phase !== 'idle'}>{s}</button>
			{/each}
		</div>
		{#if error}<p class="error">{error}</p>{/if}
	</Panel>

	<Panel title="Skill library" padded={false}>
		{#each skills as s (s.name)}
			<div class="skill" class:routed={routedSkill?.skill.name === s.name}>
				<button class="skill-head" onclick={() => (viewing = viewing?.name === s.name ? null : s)}>
					<span class="skill-name">{s.name}</span>
					<span class="skill-desc">{s.description}</span>
					<span class="skill-meta">
						triggers: {s.triggers.join(', ') || '—'}
						{#if s.tools.length}· tools: {s.tools.join(', ')}{/if}
					</span>
				</button>
				{#if routedSkill?.skill.name === s.name}
					<div class="routed-reason">→ routed here: {routedSkill.reason}</div>
				{/if}
				{#if viewing?.name === s.name}
					<div class="skill-body">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html marked.parse(s.body, { async: false })}
					</div>
				{/if}
			</div>
		{/each}
	</Panel>

	{#if runner.steps.length}
		<Panel title="Execution timeline" padded={false}>
			<ol class="timeline">
				{#each runner.steps as step, i (i)}
					<li class="step {runner.statuses[i]}">
						<span class="step-marker">
							{#if runner.statuses[i] === 'done'}✓{:else if runner.statuses[i] === 'active'}▸{:else}{i + 1}{/if}
						</span>
						<span class="step-body">
							<span class="step-tool">{step.tool}</span>
							<span class="step-narr">{step.narration}</span>
						</span>
					</li>
				{/each}
			</ol>
			{#if runner.reports.length}
				<div class="report">
					<div class="label">report</div>
					{#each runner.reports as r, i (i)}<p>{r}</p>{/each}
				</div>
			{/if}
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
	.error {
		margin: var(--space-2) 0 0;
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		color: var(--error-text);
	}
	.skill {
		border-bottom: 1px solid var(--ui);
	}
	.skill.routed {
		border-left: 2px solid var(--primary);
	}
	.skill-head {
		display: block;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		padding: 0.5rem var(--space-3);
		cursor: pointer;
	}
	.skill-head:hover {
		background: var(--bg-3);
	}
	.skill-name {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--tx);
	}
	.skill-desc {
		display: block;
		font-size: 0.7rem;
		color: var(--tx-2);
		margin-top: 0.15rem;
		line-height: 1.4;
	}
	.skill-meta {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-3);
		margin-top: 0.2rem;
	}
	.routed-reason {
		padding: 0 var(--space-3) 0.5rem;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--primary);
	}
	.skill-body {
		padding: var(--space-2) var(--space-3) var(--space-3);
		border-top: 1px dashed var(--ui);
		font-size: 0.75rem;
		line-height: 1.55;
		color: var(--tx-2);
		max-height: 16rem;
		overflow-y: auto;
	}
	.skill-body :global(h1),
	.skill-body :global(h2) {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		text-transform: uppercase;
		color: var(--tx);
		margin: var(--space-2) 0;
	}
	.skill-body :global(ol),
	.skill-body :global(ul) {
		padding-left: 1.2rem;
		margin: 0 0 var(--space-2);
	}
	.skill-body :global(strong) {
		color: var(--tx);
	}
	.timeline {
		list-style: none;
		margin: 0;
		padding: var(--space-2) 0;
	}
	.step {
		display: flex;
		gap: var(--space-2);
		padding: 0.4rem var(--space-3);
		opacity: 0.45;
	}
	.step.active {
		opacity: 1;
		background: var(--bg-3);
	}
	.step.done {
		opacity: 0.8;
	}
	.step-marker {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--tx-3);
		width: 1.1rem;
		flex: none;
		text-align: center;
	}
	.step.active .step-marker {
		color: var(--primary);
	}
	.step.done .step-marker {
		color: var(--success-text);
	}
	.step-tool {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--primary);
	}
	.step-narr {
		display: block;
		font-size: 0.73rem;
		line-height: 1.45;
		color: var(--tx);
	}
	.report {
		border-top: 1px solid var(--ui);
		padding: var(--space-3);
	}
	.report p {
		margin: var(--space-2) 0 0;
		font-size: 0.78rem;
		line-height: 1.55;
		color: var(--tx);
	}

	:global(.pulse-marker) {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--primary) 35%, transparent);
		border: 2px solid var(--primary);
		animation: skill-pulse 1.4s ease-out infinite;
	}
	@keyframes skill-pulse {
		0% {
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 55%, transparent);
		}
		100% {
			box-shadow: 0 0 0 22px transparent;
		}
	}
</style>
