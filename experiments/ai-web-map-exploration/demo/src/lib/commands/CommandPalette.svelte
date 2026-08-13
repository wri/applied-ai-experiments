<script lang="ts">
	import { page } from '$app/state';
	import { buildContextSnapshot, serializeForPrompt } from '$lib/context/snapshot';
	import { mapStore } from '$lib/map/MapStore.svelte';
	import { LlmRun } from '$lib/llm/run.svelte';
	import { llm } from '$lib/llm/provider.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Kbd from '$lib/ui/Kbd.svelte';
	import Spinner from '$lib/ui/Spinner.svelte';
	import { StreamingMarkdown as StreamedText } from '@wri-datalab/ui';
	import { commands, fuzzyScore, type Command } from './registry.svelte';

	interface Item {
		command: Command;
		input: string;
		score: number;
	}

	let query = $state('');
	let selected = $state(0);
	let inputEl = $state<HTMLInputElement | null>(null);
	let aiActive = $state(false);
	let aiQuestion = $state('');
	const aiRun = new LlmRun();

	const items = $derived.by<Item[]>(() => {
		const q = query.trim();
		const out: Item[] = [];
		for (const command of commands.all) {
			if (command.parameterized && q.toLowerCase().startsWith(command.title.toLowerCase())) {
				out.push({ command, input: q.slice(command.title.length).trim(), score: 1000 });
				continue;
			}
			const score = fuzzyScore(q, `${command.title} ${command.keywords ?? ''}`);
			if (score !== null) out.push({ command, input: '', score });
		}
		return out.sort((a, b) => b.score - a.score).slice(0, 12);
	});

	const showAsk = $derived(query.trim().length > 2);
	const totalItems = $derived(items.length + (showAsk ? 1 : 0));

	$effect(() => {
		if (commands.paletteOpen) {
			query = '';
			selected = 0;
			aiActive = false;
			aiRun.reset();
			// focus after render
			setTimeout(() => inputEl?.focus(), 0);
		}
	});

	$effect(() => {
		void query;
		selected = 0;
	});

	function close() {
		commands.paletteOpen = false;
		aiRun.abort();
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			commands.paletteOpen = !commands.paletteOpen;
		} else if (e.key === 'Escape' && commands.paletteOpen) {
			e.preventDefault();
			close();
		}
	}

	async function runItem(index: number) {
		if (index < items.length) {
			const item = items[index];
			commands.record(item.command, item.input || undefined);
			await item.command.run({ input: item.input, closePalette: close });
		} else if (showAsk) {
			ask(query.trim());
		}
	}

	function ask(question: string) {
		aiActive = true;
		aiQuestion = question;
		const snapshot = buildContextSnapshot(mapStore, {
			activeDemo: page.params.demo ?? '',
			llmMode: llm.mode
		});
		const context = snapshot ? serializeForPrompt(snapshot) : '(map not ready)';
		aiRun.run({
			system:
				'You are a map-savvy assistant embedded in a web map application. ' +
				'Answer using the provided app context. Be concise (2-4 sentences) and concrete. ' +
				'If the question cannot be answered from the context, say what additional data would help.',
			messages: [{ role: 'user', content: `App context:\n${context}\n\nQuestion: ${question}` }],
			maxTokens: 400,
			mock: {
				kind: 'match',
				cases: [
					{
						pattern: /flood|risk/,
						text: 'The flood-risk overlay is MODELLED — amber-to-brown bands by distance from the Hậu River channel, low → very high. The land use, buildings, and places under it are real Overture Maps data. The darkest band hugs the river, which is the main flood driver here. (mock response)'
					},
					{
						pattern: /where|view|looking/,
						text: 'You are looking at Cần Thơ, Vietnam — the largest city of the Mekong Delta, on the Hậu (Bassac) River. The basemap and feature layers are real Overture Maps data (land use, buildings, roads, places); the flood bands are a modelled overlay along a ~9 km corridor. (mock response)'
					},
					{
						pattern: /zoom|scale/,
						text: 'The current viewport is at city scale — roughly a dozen kilometres across. At this zoom, land-use polygons are legible but individual buildings only render from z13; zoom in two levels for site-scale inspection. (mock response)'
					}
				],
				fallback:
					'In mock mode I answer from a small set of canned responses, and this question falls outside them — add an Anthropic key in Settings for real answers. The question and the full context snapshot were assembled correctly and would have been sent. (mock response)'
			}
		});
	}

	function onInputKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selected = Math.min(selected + 1, totalItems - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selected = Math.max(selected - 1, 0);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			runItem(selected);
		}
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#if commands.paletteOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="scrim" onclick={close}>
		<div
			class="palette"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-label="Command palette"
			tabindex="-1"
		>
			<div class="input-row">
				<input
					bind:this={inputEl}
					bind:value={query}
					onkeydown={onInputKeydown}
					placeholder="Type a command, or ask the map anything…"
					spellcheck="false"
				/>
				<Kbd>esc</Kbd>
			</div>

			{#if !aiActive}
				<ul class="results" role="listbox">
					{#each items as item, i (item.command.id)}
						<li>
							<button
								class="item"
								class:selected={i === selected}
								onclick={() => runItem(i)}
								onmouseenter={() => (selected = i)}
							>
								<span class="section">{item.command.section}</span>
								<span class="title"
									>{item.command.title}{#if item.input}<span class="param"> {item.input}</span
										>{/if}</span
								>
								{#if item.command.hint}<span class="hint">{item.command.hint}</span>{/if}
							</button>
						</li>
					{/each}
					{#if showAsk}
						<li>
							<button
								class="item ask"
								class:selected={selected === items.length}
								onclick={() => runItem(items.length)}
								onmouseenter={() => (selected = items.length)}
							>
								<span class="section ai">AI</span>
								<span class="title">Ask: <span class="param">{query.trim()}</span></span>
								<Badge tone={llm.mode === 'mock' ? 'neutral' : 'primary'}>{llm.mode}</Badge>
							</button>
						</li>
					{/if}
					{#if !items.length && !showAsk}
						<li class="empty">No matching commands</li>
					{/if}
				</ul>
			{:else}
				<div class="answer">
					<div class="question">
						{aiQuestion}
						{#if aiRun.isStreaming}<Spinner size={11} />{/if}
					</div>
					{#if aiRun.error}
						<p class="error">{aiRun.error}</p>
					{:else}
						<StreamedText content={aiRun.content} streaming={aiRun.isStreaming} />
					{/if}
					<button class="back" onclick={() => (aiActive = false)}>← back to commands</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.scrim {
		position: fixed;
		inset: 0;
		background: oklch(0 0 0 / 0.45);
		z-index: var(--z-modal);
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding-top: 12vh;
	}
	.palette {
		width: min(36rem, calc(100vw - 2rem));
		background: var(--bg-2);
		border: 1px solid var(--ui-2);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-default);
		overflow: hidden;
	}
	.input-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3);
		border-bottom: 1px solid var(--ui);
	}
	input {
		flex: 1;
		background: none;
		border: none;
		outline: none;
		color: var(--tx);
		font-family: var(--font-mono);
		font-size: 0.875rem;
	}
	input::placeholder {
		color: var(--tx-3);
	}
	.results {
		list-style: none;
		margin: 0;
		padding: var(--space-2);
		max-height: 21rem;
		overflow-y: auto;
	}
	.item {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		border-radius: var(--radius-sm);
		padding: 0.45rem var(--space-2);
		cursor: pointer;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		color: var(--tx);
	}
	.item.selected {
		background: var(--bg-3);
	}
	.section {
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tx-3);
		width: 4.2rem;
		flex: none;
	}
	.section.ai {
		color: var(--primary);
	}
	.title {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.param {
		color: var(--primary);
	}
	.hint {
		font-size: 0.65rem;
		color: var(--tx-3);
	}
	.empty {
		padding: var(--space-4);
		text-align: center;
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		color: var(--tx-3);
	}
	.answer {
		padding: var(--space-4);
	}
	.question {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		color: var(--tx-2);
		margin-bottom: var(--space-3);
	}
	.error {
		color: var(--error-text);
		font-family: var(--font-mono);
		font-size: var(--text-ui);
	}
	.back {
		margin-top: var(--space-3);
		background: none;
		border: none;
		color: var(--tx-3);
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		cursor: pointer;
		padding: 0;
	}
	.back:hover {
		color: var(--tx);
	}
</style>
