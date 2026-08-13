<script lang="ts">
	import { mapStore } from '$lib/map/MapStore.svelte';
	import { llm } from '$lib/llm/provider.svelte';
	import { LlmRun } from '$lib/llm/run.svelte';
	import { StructuredOutputError } from '$lib/llm/structured';
	import OverlayPanel from '$lib/shell/OverlayPanel.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { Button } from '@wri-datalab/ui';
	import Panel from '$lib/ui/Panel.svelte';
	import Spinner from '$lib/ui/Spinner.svelte';
	import { StreamingMarkdown as StreamedText } from '@wri-datalab/ui';
	import { Input as TextInput } from '@wri-datalab/ui';
	import OvertureScene from '../shared/OvertureScene.svelte';
	import {
		FLOOD_COLORS,
		FLOOD_LABELS,
		FLOOD_RISK_CLASSES,
		LANDUSE_COLORS,
		LANDUSE_LABELS,
		LANDUSE_FALLBACK_COLOR,
		type InteractiveLayerId
	} from '../shared/canTho';
	import { LEGEND_CLASSES, LEGEND_SPEC_SCHEMA, restyleMock, ASK_MOCKS, type LegendSpec } from './mocks';
	import type { FilterSpecification } from 'maplibre-gl';

	// --- legend state (real Overture land_use classes) ---
	let enabled = $state<Record<string, boolean>>(
		Object.fromEntries(LEGEND_CLASSES.map((k) => [k, true]))
	);
	let hovered = $state<string | null>(null);
	let counts = $state<Record<string, number>>({});
	let colors = $state<Record<string, string>>({ ...LANDUSE_COLORS });
	let labels = $state<Record<string, string>>({ ...LANDUSE_LABELS });
	let restyled = $state(false);

	// Counts are what is *rendered in the current viewport* — the legend describes
	// the view, not a fixed file (tile features can be split; treat as approximate).
	$effect(() => {
		void mapStore.viewport;
		void mapStore.sceneVersion;
		const map = mapStore.map;
		if (!map || !map.getLayer('landuse-fill')) return;
		const feats = map.queryRenderedFeatures({ layers: ['landuse-fill'] });
		const c: Record<string, number> = {};
		const seen = new Set<string | number | undefined>();
		for (const f of feats) {
			if (f.id !== undefined && seen.has(f.id)) continue;
			seen.add(f.id);
			const k = String(f.properties?.class);
			c[k] = (c[k] ?? 0) + 1;
		}
		counts = c;
	});

	const filters = $derived.by(() => {
		const active = LEGEND_CLASSES.filter((k) => enabled[k]);
		const out: Partial<Record<InteractiveLayerId, FilterSpecification | null>> = {
			'landuse-fill': null,
			'landuse-outline': null
		};
		if (active.length !== LEGEND_CLASSES.length) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const f = ['in', ['get', 'class'], ['literal', active]] as any;
			out['landuse-fill'] = f;
			out['landuse-outline'] = f;
		}
		return out;
	});

	const paints = $derived.by(() => {
		const colorExpr = [
			'match',
			['get', 'class'],
			...LEGEND_CLASSES.flatMap((k) => [k, colors[k]]),
			LANDUSE_FALLBACK_COLOR
		];
		const opacityExpr = hovered ? ['match', ['get', 'class'], hovered, 0.85, 0.08] : 0.45;
		return {
			'landuse-fill': { 'fill-color': colorExpr, 'fill-opacity': opacityExpr }
		} as Partial<Record<InteractiveLayerId, Record<string, unknown>>>;
	});

	// --- ask affordance ---
	let askClass = $state<string | null>(null);
	const ask = new LlmRun();

	function askAbout(k: string) {
		askClass = k;
		ask.run({
			system:
				'You are a map assistant. The user clicked the legend row for a land-use class on a map of ' +
				'Can Tho, Vietnam. The layer is REAL Overture Maps land use (ODbL, largely OSM-derived). ' +
				'Explain in 2-3 sentences what this class covers here and what a user should check before ' +
				'trusting its coverage.',
			messages: [
				{
					role: 'user',
					content: `Class: ${k} (${counts[k] ?? '?'} features in view). Source: Overture base theme, land_use type.`
				}
			],
			maxTokens: 300,
			mock: { kind: 'text', text: ASK_MOCKS[k] ?? `No canned answer for ${k}. (mock response)` }
		});
	}

	// --- NL restyle ---
	let restylePrompt = $state('');
	let restyling = $state(false);
	let restyleError = $state<string | null>(null);
	let lastRationale = $state<string | null>(null);

	async function restyle(text?: string) {
		const q = (text ?? restylePrompt).trim();
		if (!q || restyling) return;
		restylePrompt = q;
		restyling = true;
		restyleError = null;
		try {
			const result = await llm.structured<LegendSpec>(
				{
					system:
						'You restyle a categorical map legend for real Overture land-use classes. ' +
						`Classes (fixed, in order): ${LEGEND_CLASSES.join(', ')}. ` +
						"Return a color (hex) and short label for each class. Respect the user's intent about palette.",
					messages: [{ role: 'user', content: `Restyle request: ${q}` }],
					maxTokens: 700,
					mock: restyleMock()
				},
				LEGEND_SPEC_SCHEMA
			);
			const spec = result.value;
			const nextColors = { ...colors };
			const nextLabels = { ...labels };
			for (const c of spec.classes) {
				nextColors[c.value] = c.color;
				if (c.label) nextLabels[c.value] = c.label;
			}
			colors = nextColors;
			labels = nextLabels;
			lastRationale = spec.rationale;
			restyled = true;
		} catch (e) {
			restyleError =
				e instanceof StructuredOutputError
					? `Rejected: ${e.validationErrors.join('; ')}`
					: (e as Error).message;
		} finally {
			restyling = false;
		}
	}

	function revertStyle() {
		colors = { ...LANDUSE_COLORS };
		labels = { ...LANDUSE_LABELS };
		restyled = false;
		lastRationale = null;
	}
</script>

<OvertureScene {filters} {paints} />

<OverlayPanel side="right" width="24rem">
	<Panel title="Legend · land use (Overture)" padded={false}>
		{#snippet actions()}
			{#if restyled}<Button size="sm" onclick={revertStyle}>revert</Button>{/if}
		{/snippet}
		<div class="legend-rows" onmouseleave={() => (hovered = null)} role="list">
			{#each LEGEND_CLASSES as k (k)}
				<div
					class="legend-row"
					class:off={!enabled[k]}
					role="listitem"
					onmouseenter={() => (hovered = k)}
				>
					<button
						class="row-main"
						onclick={() => (enabled = { ...enabled, [k]: !enabled[k] })}
						title="Click to toggle class"
					>
						<i style:background={colors[k]}></i>
						<span class="lbl">{labels[k]}</span>
						<span class="count">{counts[k] ?? '–'}</span>
					</button>
					<button class="ask-btn" title="Ask about this class" onclick={() => askAbout(k)}>
						ask
					</button>
				</div>
			{/each}
		</div>
		<div class="legend-help">
			hover = emphasize · click = toggle · <strong>ask</strong> = query the class · counts = in view
		</div>
	</Panel>

	<Panel title="Flood risk" padded={false}>
		{#snippet actions()}
			<Badge tone="warning">modelled</Badge>
		{/snippet}
		<div class="legend-rows" role="list">
			{#each FLOOD_RISK_CLASSES as k (k)}
				<div class="legend-row static" role="listitem">
					<div class="row-main as-div">
						<i style:background={FLOOD_COLORS[k]}></i>
						<span class="lbl">{FLOOD_LABELS[k]}</span>
					</div>
				</div>
			{/each}
		</div>
		<div class="legend-help">
			distance-band model, not observed data — the land use above is real Overture/OSM
		</div>
	</Panel>

	{#if askClass}
		<Panel title="About “{labels[askClass]}”">
			{#snippet actions()}
				{#if ask.isStreaming}<Spinner size={11} />{/if}
			{/snippet}
			{#if ask.error}
				<p class="error">{ask.error}</p>
			{:else}
				<StreamedText content={ask.content} streaming={ask.isStreaming} />
			{/if}
		</Panel>
	{/if}

	<Panel title="Restyle in natural language">
		{#snippet actions()}
			<Badge tone={llm.mode === 'mock' ? 'neutral' : 'primary'}>{llm.mode}</Badge>
		{/snippet}
		<form
			onsubmit={(e) => {
				e.preventDefault();
				restyle();
			}}
		>
			<TextInput bind:value={restylePrompt} placeholder="make it colorblind-safe…" />
			<div class="row">
				<Button variant="primary" type="submit" disabled={restyling || !restylePrompt.trim()}>
					{#if restyling}<Spinner size={12} />{/if}
					restyle
				</Button>
			</div>
		</form>
		<div class="chips">
			{#each ['Make it colorblind-safe', 'Mute everything except agriculture', 'High-contrast for projection'] as s (s)}
				<button class="chip" onclick={() => restyle(s)} disabled={restyling}>{s}</button>
			{/each}
		</div>
		{#if lastRationale}
			<p class="rationale">{lastRationale}</p>
		{/if}
		{#if restyleError}<p class="error">{restyleError}</p>{/if}
		<p class="note">
			The model returns a constrained legend spec (class → color + label), validated against a
			schema before it touches the map. The legend is the interaction surface: the layer is
			engaged through it, not around it.
		</p>
	</Panel>
</OverlayPanel>

<style>
	.legend-rows {
		display: flex;
		flex-direction: column;
	}
	.legend-row {
		display: flex;
		align-items: stretch;
		border-bottom: 1px solid var(--ui);
	}
	.legend-row:hover:not(.static) {
		background: var(--bg-3);
	}
	.legend-row.off {
		opacity: 0.4;
	}
	.row-main {
		flex: 1;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		background: none;
		border: none;
		padding: 0.5rem var(--space-3);
		cursor: pointer;
		text-align: left;
	}
	.row-main.as-div {
		cursor: default;
	}
	.row-main i {
		width: 14px;
		height: 14px;
		border-radius: 3px;
		flex: none;
		border: 1px solid oklch(0 0 0 / 0.25);
	}
	.lbl {
		flex: 1;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--tx);
	}
	.count {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--tx-3);
	}
	.ask-btn {
		background: none;
		border: none;
		border-left: 1px solid var(--ui);
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-3);
		padding: 0 var(--space-3);
		cursor: pointer;
	}
	.ask-btn:hover {
		color: var(--primary);
	}
	.legend-help {
		padding: 0.4rem var(--space-3);
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-3);
	}
	.legend-help strong {
		color: var(--tx-2);
	}
	.row {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: var(--space-3);
	}
	.chip {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--tx-2);
		background: var(--bg);
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		padding: 0.3rem 0.5rem;
		cursor: pointer;
	}
	.chip:hover:not(:disabled) {
		border-color: var(--primary);
		color: var(--tx);
	}
	.rationale {
		margin: var(--space-3) 0 0;
		font-size: 0.75rem;
		color: var(--tx);
		line-height: 1.5;
	}
	.note {
		margin: var(--space-3) 0 0;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--tx-3);
		line-height: 1.5;
	}
	.error {
		margin: var(--space-2) 0 0;
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		color: var(--error-text);
	}
</style>
