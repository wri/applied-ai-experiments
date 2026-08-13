<script lang="ts">
	import { page } from '$app/state';
	import { geocode } from '$lib/map/geocode';
	import { mapStore } from '$lib/map/MapStore.svelte';
	import { llm } from '$lib/llm/provider.svelte';
	import { StructuredOutputError } from '$lib/llm/structured';
	import { decodeState, writeStateParam, clearStateParam } from '$lib/state/urlState';
	import OverlayPanel from '$lib/shell/OverlayPanel.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { Button } from '@wri-datalab/ui';
	import Panel from '$lib/ui/Panel.svelte';
	import Spinner from '$lib/ui/Spinner.svelte';
	import { Input as TextInput } from '@wri-datalab/ui';
	import OvertureScene from '../shared/OvertureScene.svelte';
	import Legend from '../shared/Legend.svelte';
	import {
		FLOOD_COLORS,
		FLOOD_LABELS,
		FLOOD_RISK_CLASSES,
		LANDUSE_COLORS,
		LANDUSE_LABELS,
		PLACE_COLOR,
		type FloodRisk,
		type InteractiveLayerId
	} from '../shared/canTho';
	import { queryMock, REFINEMENTS, SUGGESTIONS } from './mocks';
	import {
		describeFilter,
		filtersToLayerExpressions,
		targetedLayers,
		QUERY_SCHEMA,
		type ParsedQuery
	} from './schema';
	import type { FilterSpecification } from 'maplibre-gl';

	interface UrlState {
		q: string;
		parsed: ParsedQuery;
		camera: { center: [number, number]; zoom: number };
	}

	interface HistoryEntry {
		q: string;
		parsed: ParsedQuery;
		camera: { center: [number, number]; zoom: number };
	}

	let query = $state('');
	let running = $state(false);
	let error = $state<string | null>(null);
	// Breadcrumb trail of refinement turns; `cursor` marks the active one.
	let history = $state<HistoryEntry[]>([]);
	let cursor = $state(0);
	const current = $derived<HistoryEntry | null>(history[cursor] ?? null);
	let restoredFromUrl = $state(false);
	let shareUrl = $state<string | null>(null);
	let copied = $state(false);

	// --- filter diff vs the previous turn (pure code, no LLM) ---
	interface DiffItem {
		kind: 'added' | 'removed' | 'changed';
		text: string;
	}

	const diff = $derived.by<DiffItem[]>(() => {
		if (cursor === 0 || !current) return [];
		const prev = history[cursor - 1].parsed;
		const next = current.parsed;
		const items: DiffItem[] = [];
		const prevByAttr = new Map(prev.filters.map((f) => [f.attribute, f]));
		const nextByAttr = new Map(next.filters.map((f) => [f.attribute, f]));
		for (const [attr, f] of nextByAttr) {
			const p = prevByAttr.get(attr);
			if (!p) items.push({ kind: 'added', text: describeFilter(f) });
			else if (JSON.stringify(p) !== JSON.stringify(f)) {
				items.push({ kind: 'changed', text: `${describeFilter(p)} → ${describeFilter(f)}` });
			}
		}
		for (const [attr, p] of prevByAttr) {
			if (!nextByAttr.has(attr)) items.push({ kind: 'removed', text: describeFilter(p) });
		}
		if (prev.highlightColor !== next.highlightColor) {
			if (!prev.highlightColor) items.push({ kind: 'added', text: `highlight ${next.highlightColor}` });
			else if (!next.highlightColor) items.push({ kind: 'removed', text: `highlight ${prev.highlightColor}` });
			else items.push({ kind: 'changed', text: `highlight ${prev.highlightColor} → ${next.highlightColor}` });
		}
		return items;
	});

	// Per-layer filters: attributes live on different layers (real land use /
	// places vs the modelled flood overlay), so each targeted layer gets its own
	// filter and every non-targeted layer's filter is cleared.
	const layerFilters = $derived.by(() => {
		const out: Partial<Record<InteractiveLayerId, FilterSpecification | null>> = {
			'landuse-fill': null,
			'landuse-outline': null,
			'flood-zones': null,
			'flood-zones-outline': null,
			'places-dots': null
		};
		if (!current) return out;
		for (const [layer, expr] of filtersToLayerExpressions(current.parsed.filters)) {
			out[layer] = expr;
			if (layer === 'landuse-fill') out['landuse-outline'] = expr;
			if (layer === 'flood-zones') out['flood-zones-outline'] = expr;
		}
		return out;
	});

	const paints = $derived.by(() => {
		const color = current?.parsed.highlightColor;
		const out: Partial<Record<InteractiveLayerId, Record<string, unknown>>> = {};
		if (!color || !current) return out;
		const targets = targetedLayers(current.parsed.filters);
		for (const layer of targets) {
			// When the flood overlay is only one of several targets it acts as a
			// spatial condition — keep its amber ramp (just quieter) so the
			// highlighted features stay legible on top of it.
			if (layer === 'flood-zones' && targets.size > 1) {
				out[layer] = { 'fill-opacity': 0.15 };
			} else if (layer === 'places-dots') {
				out[layer] = { 'circle-color': color, 'circle-opacity': 0.9, 'circle-radius': 4 };
			} else {
				out[layer] = { 'fill-color': color, 'fill-opacity': 0.7 };
			}
		}
		return out;
	});

	const legendEntries = $derived.by(() => {
		if (!current) return [];
		if (current.parsed.highlightColor) {
			return [{ color: current.parsed.highlightColor, label: 'matching features' }];
		}
		const entries: { color: string; label: string }[] = [];
		const seen = new Set<string>();
		for (const f of current.parsed.filters) {
			const values = Array.isArray(f.value) ? f.value : [f.value];
			if (f.attribute === 'landuse_class') {
				for (const v of values) {
					const key = String(v);
					if (!seen.has(key) && LANDUSE_COLORS[key]) {
						seen.add(key);
						entries.push({ color: LANDUSE_COLORS[key], label: LANDUSE_LABELS[key] ?? key });
					}
				}
			} else if (f.attribute === 'flood_risk') {
				const classes =
					f.op === '==' || f.op === 'in'
						? (values as FloodRisk[]).filter((v) => FLOOD_RISK_CLASSES.includes(v))
						: [...FLOOD_RISK_CLASSES];
				for (const c of classes) {
					if (!seen.has(c)) {
						seen.add(c);
						entries.push({ color: FLOOD_COLORS[c], label: `${FLOOD_LABELS[c]} (modelled)` });
					}
				}
			} else if (f.attribute.startsWith('place_') && !seen.has('places')) {
				seen.add('places');
				entries.push({ color: PLACE_COLOR, label: 'matching places' });
			}
		}
		return entries.length
			? entries
			: (Object.keys(FLOOD_COLORS) as FloodRisk[]).map((k) => ({
					color: FLOOD_COLORS[k],
					label: `${FLOOD_LABELS[k]} (modelled)`
				}));
	});

	// Restore from ?s= once on mount (reproducible URL — no LLM call)
	$effect(() => {
		const s = decodeState<UrlState>(page.url.searchParams.get('s'));
		if (s && !history.length) {
			history = [{ q: s.q, parsed: s.parsed, camera: s.camera }];
			cursor = 0;
			restoredFromUrl = true;
			mapStore.jumpTo(s.camera);
		}
	});

	const BASE_SYSTEM =
		'You parse natural-language map queries into spatial filters over real Overture Maps ' +
		'layers in Can Tho, Vietnam (Mekong Delta), plus one modelled overlay.\n' +
		'Attributes (attribute → values):\n' +
		'- landuse_class (real Overture land use): farmland | orchard | aquaculture | grass | park | residential | industrial | commercial | school\n' +
		'- landuse_subtype (real): agriculture | horticulture | developed | recreation | education | managed | residential | park | medical\n' +
		'- flood_risk (MODELLED distance-band overlay): low | medium | high | very_high\n' +
		'- place_category (real Overture places): restaurant | coffee_shop | cafe | casual_eatery | hotel | personal_or_beauty_service | fashion_and_apparel_store | electronics_store | school\n' +
		'- place_confidence (real, number 0.5-1.0)\n' +
		'"flood-prone" means flood_risk in [high, very_high]. "rice" or "paddies" map to landuse_class farmland. ' +
		'Include a legend title. Set place when the query names one; omit camera unless coordinates are explicit.';

	async function applyParsed(q: string, parsed: ParsedQuery) {
		// resolve camera: explicit > geocoded place > stay put
		let camera = parsed.camera;
		if (!camera && parsed.place) {
			const g = await geocode(parsed.place);
			if (g) camera = { center: g.center, zoom: g.zoom };
		}
		if (camera) await mapStore.flyTo(camera);
		// serialize RESOLVED state (camera included) into the URL
		const resolvedCamera = camera ?? {
			center: mapStore.viewport.center,
			zoom: mapStore.viewport.zoom
		};
		// a new turn truncates any forward branch (like undo history)
		history = [...history.slice(0, cursor + 1), { q, parsed, camera: resolvedCamera }];
		cursor = history.length - 1;
		shareUrl = writeStateParam({ q, parsed, camera: resolvedCamera } satisfies UrlState);
	}

	async function run(text?: string) {
		const q = (text ?? query).trim();
		if (!q || running) return;
		query = q;
		running = true;
		error = null;
		restoredFromUrl = false;
		const refining = current !== null;
		try {
			const result = await llm.structured<ParsedQuery>(
				{
					system: refining
						? BASE_SYSTEM +
							'\n\nThis is a REFINEMENT turn: the user is editing the current parse, not starting over. ' +
							'Return the COMPLETE updated parse (not a delta). Keep everything the refinement does not ' +
							'mention; omit place/camera unless the refinement names a new location.'
						: BASE_SYSTEM,
					messages: [
						{
							role: 'user',
							content: refining
								? `Current parsed state: ${JSON.stringify(current!.parsed)}\nRefinement: ${q}`
								: `Query: ${q}`
						}
					],
					maxTokens: 700,
					mock: queryMock()
				},
				QUERY_SCHEMA
			);
			await applyParsed(q, result.value);
			query = '';
		} catch (e) {
			error =
				e instanceof StructuredOutputError
					? `Could not parse the query: ${e.validationErrors.join('; ')}`
					: (e as Error).message;
		} finally {
			running = false;
		}
	}

	/** Roll back/forward to a breadcrumb — no LLM call, state is already resolved. */
	function jumpToTurn(i: number) {
		if (i === cursor || running) return;
		cursor = i;
		const entry = history[i];
		mapStore.jumpTo(entry.camera);
		shareUrl = writeStateParam({
			q: entry.q,
			parsed: entry.parsed,
			camera: entry.camera
		} satisfies UrlState);
	}

	function clear() {
		history = [];
		cursor = 0;
		query = '';
		shareUrl = null;
		restoredFromUrl = false;
		clearStateParam();
	}

	async function copyShare() {
		if (!shareUrl) return;
		await navigator.clipboard.writeText(shareUrl);
		copied = true;
		setTimeout(() => (copied = false), 1200);
	}
</script>

<OvertureScene filters={layerFilters} {paints} />

{#if current}
	<Legend
		title={current.parsed.legend.title}
		entries={legendEntries}
		note={current.parsed.legend.note}
	/>
{/if}

<OverlayPanel side="right" width="25rem">
	<Panel title="Query to viewport">
		{#snippet actions()}
			<Badge tone={llm.mode === 'mock' ? 'neutral' : 'primary'}>{llm.mode}</Badge>
		{/snippet}
		<p class="lead">
			One sentence becomes camera + filters + style + legend — and the URL captures the resolved
			state, shareable and reproducible without re-calling the model.
		</p>
		<form
			onsubmit={(e) => {
				e.preventDefault();
				run();
			}}
		>
			<TextInput
				bind:value={query}
				placeholder={current
					? 'Refine: now only the very-high band…'
					: 'Show farmland in the high flood-risk bands…'}
			/>
			<div class="row">
				<Button variant="primary" type="submit" disabled={running || !query.trim()}>
					{#if running}<Spinner size={12} />{/if}
					{current ? 'refine' : 'query'}
				</Button>
				{#if current}
					<Button onclick={clear}>new query</Button>
					<Button onclick={copyShare}>{copied ? 'copied!' : 'share url'}</Button>
				{/if}
			</div>
		</form>
		<div class="chips">
			{#each current ? REFINEMENTS : SUGGESTIONS as s (s)}
				<button class="chip" onclick={() => run(s)} disabled={running}>{s}</button>
			{/each}
		</div>
		{#if error}<p class="error">{error}</p>{/if}

		{#if history.length > 1}
			<div class="label crumbs-label">refinement trail</div>
			<div class="crumbs">
				{#each history as h, i (i)}
					<button
						class="crumb"
						class:active={i === cursor}
						title={h.q}
						onclick={() => jumpToTurn(i)}
					>
						<span class="crumb-n">{i + 1}</span>
						<span class="crumb-q">{h.q.length > 34 ? h.q.slice(0, 34) + '…' : h.q}</span>
					</button>
				{/each}
			</div>
			<p class="crumbs-note">
				each step is resolved state — clicking one rolls back (and rewrites the URL) without a
				model call
			</p>
		{/if}
	</Panel>

	{#if current}
		<Panel title="Resolved intent">
			{#if restoredFromUrl}
				<div class="restored">
					<Badge tone="info">restored from URL</Badge>
					<span>no model call — the link carried the resolved state</span>
				</div>
			{/if}
			<div class="label">{cursor === 0 ? 'query' : `refinement ${cursor + 1}`}</div>
			<p class="q">“{current.q}”</p>
			{#if diff.length}
				<div class="label">changes vs previous</div>
				<div class="diff">
					{#each diff as d, i (i)}
						<span class="diff-chip {d.kind}">
							{d.kind === 'added' ? '+' : d.kind === 'removed' ? '−' : '±'}
							{d.text}
						</span>
					{/each}
				</div>
			{/if}
			<div class="label">filters</div>
			{#if current.parsed.filters.length}
				<ul class="filters">
					{#each current.parsed.filters as f, i (i)}
						<li><code>{describeFilter(f)}</code></li>
					{/each}
				</ul>
			{:else}
				<p class="q">none — all features shown</p>
			{/if}
			{#if current.parsed.place}
				<div class="label">place</div>
				<p class="q">{current.parsed.place}</p>
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
		margin: var(--space-3) 0 0;
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		color: var(--error-text);
	}
	.restored {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-3);
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-3);
	}
	.q {
		margin: 0.15rem 0 var(--space-3);
		font-size: 0.78rem;
		color: var(--tx);
	}
	.filters {
		list-style: none;
		margin: 0.15rem 0 var(--space-3);
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.filters code {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--primary);
		background: var(--bg);
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		padding: 0.2rem 0.4rem;
		display: inline-block;
	}
	.crumbs-label {
		margin-top: var(--space-3);
	}
	.crumbs {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-top: 0.25rem;
	}
	.crumb {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		text-align: left;
		background: var(--bg);
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		padding: 0.25rem 0.4rem;
		cursor: pointer;
	}
	.crumb.active {
		border-color: var(--primary);
	}
	.crumb-n {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		color: var(--primary);
		flex: none;
	}
	.crumb-q {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--tx-2);
	}
	.crumb.active .crumb-q {
		color: var(--tx);
	}
	.crumbs-note {
		margin: var(--space-2) 0 0;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		line-height: 1.5;
		color: var(--tx-3);
	}
	.diff {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin: 0.15rem 0 var(--space-3);
	}
	.diff-chip {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		border-radius: var(--radius-sm);
		padding: 0.15rem 0.4rem;
		border: 1px solid var(--ui);
	}
	.diff-chip.added {
		color: var(--success-text);
		border-color: color-mix(in srgb, var(--success) 45%, transparent);
		background: var(--success-subtle);
	}
	.diff-chip.removed {
		color: var(--error-text);
		border-color: color-mix(in srgb, var(--error) 45%, transparent);
		background: var(--error-subtle);
	}
	.diff-chip.changed {
		color: var(--warning-text);
		border-color: color-mix(in srgb, var(--warning) 45%, transparent);
		background: var(--warning-subtle);
	}
</style>
