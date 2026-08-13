<script lang="ts">
	import { page } from '$app/state';
	import { buildContextSnapshot, serializeForPrompt } from '$lib/context/snapshot';
	import { mapStore } from '$lib/map/MapStore.svelte';
	import { captureViewport, type Screenshot } from '$lib/map/screenshot';
	import { llm } from '$lib/llm/provider.svelte';
	import { LlmRun } from '$lib/llm/run.svelte';
	import OverlayPanel from '$lib/shell/OverlayPanel.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { Button } from '@wri-datalab/ui';
	import Panel from '$lib/ui/Panel.svelte';
	import { Select } from '@wri-datalab/ui';
	import Spinner from '$lib/ui/Spinner.svelte';
	import { StreamingMarkdown as StreamedText } from '@wri-datalab/ui';
	import GeoJSONSource from '$lib/map/GeoJSONSource.svelte';
	import MapLayer from '$lib/map/MapLayer.svelte';
	import OvertureScene from '../shared/OvertureScene.svelte';
	import {
		CONFIDENCE_COLORS,
		EVIDENCE_SCHEMA,
		EVIDENCE_SYSTEM,
		evidenceMock,
		type Evidence,
		type EvidenceClaim
	} from './evidence';

	// --- levers ---
	let verbosity = $state('normal');
	let confidence = $state('calibrated');
	let focus = $state('describe');
	let audience = $state('analyst');

	const LEVERS = {
		verbosity: {
			terse: 'Answer in at most 2 sentences.',
			normal: 'Answer in one short paragraph.',
			detailed: 'Answer in 2-3 paragraphs with specific visual evidence.'
		},
		confidence: {
			calibrated:
				'Attach an explicit confidence (high/medium/low) to each claim and hedge what the image cannot support.',
			assertive: 'State your best interpretation plainly, without hedging.',
			skeptical:
				'Lead with what could be misread in this image; treat every interpretation as provisional.'
		},
		focus: {
			describe: 'Describe what is visually present.',
			interpret: 'Interpret what the patterns mean for land use and water.',
			anomalies: 'Hunt for anomalies — what does not fit the surrounding pattern?'
		},
		audience: {
			analyst: 'Write for a geospatial analyst; technical vocabulary is fine.',
			policymaker: 'Write for a policymaker; plain language, lead with implications.',
			child: 'Write for a curious 10-year-old.'
		}
	} as const;

	let shot = $state<Screenshot | null>(null);
	let shotFailed = $state(false);
	const run = new LlmRun();

	// --- pointable evidence ---
	interface CapturedCamera {
		center: [number, number];
		zoom: number;
		bearing: number;
		pitch: number;
	}
	let capturedCamera = $state<CapturedCamera | null>(null);
	let evidenceRunning = $state(false);
	let evidenceError = $state<string | null>(null);
	let hoveredClaim = $state<number | null>(null);

	/** Claims with their boxes translated to geographic rings at storage time. */
	interface PlacedClaim extends EvidenceClaim {
		idx: number;
		ring: [number, number][];
	}
	let placed = $state<PlacedClaim[]>([]);
	let visibleBoxes = $state<Set<number>>(new Set());

	const cameraMoved = $derived.by(() => {
		if (!capturedCamera) return false;
		const v = mapStore.viewport;
		return (
			Math.abs(v.center[0] - capturedCamera.center[0]) > 1e-5 ||
			Math.abs(v.center[1] - capturedCamera.center[1]) > 1e-5 ||
			Math.abs(v.zoom - capturedCamera.zoom) > 0.01 ||
			Math.abs(v.bearing - capturedCamera.bearing) > 0.1 ||
			Math.abs(v.pitch - capturedCamera.pitch) > 0.1
		);
	});

	async function extractEvidence() {
		if (!shot) return;
		evidenceRunning = true;
		evidenceError = null;
		placed = [];
		visibleBoxes = new Set();
		try {
			const result = await llm.structured<Evidence>(
				{
					system: EVIDENCE_SYSTEM,
					maxTokens: 700,
					messages: [
						{
							role: 'user',
							content: [
								{ type: 'image' as const, mediaType: 'image/jpeg', base64: shot.base64 },
								{
									type: 'text' as const,
									text: 'Return the visually-checkable claims with their evidence boxes.'
								}
							]
						}
					],
					mock: evidenceMock()
				},
				EVIDENCE_SCHEMA
			);
			placeClaims(result.value.claims);
		} catch (e) {
			evidenceError = (e as Error).message;
		} finally {
			evidenceRunning = false;
		}
	}

	/**
	 * Translate image-space boxes to geographic rings the moment they arrive, so
	 * they render regardless of later camera moves. If the camera has already
	 * moved, do a synchronous jumpTo round-trip through the captured camera —
	 * both jumps happen in one JS task and MapLibre renders on rAF, so no
	 * intermediate frame is ever painted.
	 */
	function placeClaims(claims: EvidenceClaim[]) {
		const map = mapStore.map;
		const cam = capturedCamera;
		if (!map || !cam) return;
		if (map.isMoving()) {
			map.once('idle', () => placeClaims(claims));
			return;
		}
		const moved = cameraMoved;
		const current = moved
			? {
					center: map.getCenter().toArray() as [number, number],
					zoom: map.getZoom(),
					bearing: map.getBearing(),
					pitch: map.getPitch()
				}
			: null;
		if (moved) map.jumpTo(cam);
		// Normalized image coords → CSS-pixel container coords (the screenshot is
		// a uniform downscale of the full canvas) → geographic corners.
		const w = map.getContainer().clientWidth;
		const h = map.getContainer().clientHeight;
		placed = claims.map((c, idx) => {
			const [x0, y0, x1, y1] = c.bbox;
			const corners: [number, number][] = [
				[x0 * w, y0 * h],
				[x1 * w, y0 * h],
				[x1 * w, y1 * h],
				[x0 * w, y1 * h]
			];
			const ring = corners.map((pt) => {
				const ll = map.unproject(pt);
				return [ll.lng, ll.lat] as [number, number];
			});
			ring.push(ring[0]);
			return { ...c, idx, ring };
		});
		if (moved && current) map.jumpTo(current);
		visibleBoxes = new Set(placed.map((p) => p.idx));
	}

	function toggleBox(idx: number) {
		const next = new Set(visibleBoxes);
		if (next.has(idx)) next.delete(idx);
		else next.add(idx);
		visibleBoxes = next;
	}

	function flyBack() {
		if (!capturedCamera) return;
		mapStore.easeTo({ ...capturedCamera }, 800);
	}

	const boxesFc = $derived.by<GeoJSON.FeatureCollection>(() => ({
		type: 'FeatureCollection',
		features: placed.map((p) => ({
			type: 'Feature',
			id: p.idx,
			properties: { idx: p.idx, confidence: p.confidence, label: p.text },
			geometry: { type: 'Polygon', coordinates: [p.ring] }
		}))
	}));

	const confidenceColorExpr = [
		'match',
		['get', 'confidence'],
		'high',
		CONFIDENCE_COLORS.high,
		'medium',
		CONFIDENCE_COLORS.medium,
		CONFIDENCE_COLORS.low
	];

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const visibleFilter = $derived(['in', ['id'], ['literal', [...visibleBoxes]]] as any);
	const lineEmphasis = $derived({
		'line-width': ['case', ['==', ['id'], hoveredClaim ?? -1], 4, 2.5]
	});
	const fillEmphasis = $derived({
		'fill-opacity': ['case', ['==', ['id'], hoveredClaim ?? -1], 0.2, 0.08]
	});

	function systemPrompt(): string {
		return [
			'You are analyzing a screenshot of a web map viewport, with app context attached.',
			LEVERS.verbosity[verbosity as keyof typeof LEVERS.verbosity],
			LEVERS.confidence[confidence as keyof typeof LEVERS.confidence],
			LEVERS.focus[focus as keyof typeof LEVERS.focus],
			LEVERS.audience[audience as keyof typeof LEVERS.audience]
		].join(' ');
	}

	function mockText(): string {
		const scale = confidence === 'assertive' ? '' : ' (medium confidence — resolution limits certainty)';
		const body =
			focus === 'anomalies'
				? `Mapped land use thins abruptly northwest of the urban core even though the imagery shows continuous cultivation — an OSM coverage gap in the real Overture data, not a land-cover change${scale}. Also notable: the amber flood-band boundaries run geometrically parallel to the channel, betraying their distance-model origin.`
				: focus === 'interpret'
					? `The amber banding tracks the river: darker bands — higher modelled flood risk — hug the Hậu River channel, consistent with low-lying riverside land${scale}. The real Overture land use inside the darkest band skews urban and industrial, so exposure is not just an agricultural story here.`
					: `The frame shows a riverside city on a wide meandering channel — Cần Thơ on the Hậu River — with real Overture land use and place data under amber modelled flood-risk bands${scale}. The darkest band hugs the near bank; farmland dominates away from the water.`;
		const prefix =
			audience === 'child'
				? 'Imagine the map is wearing a heat-map costume: '
				: audience === 'policymaker'
					? 'Bottom line: '
					: '';
		const suffix = verbosity === 'detailed'
			? '\n\nEvidence: the amber ramp maps band intensity to modelled risk class; the visible water body and its branching side channels anchor the geography; the land-use mosaic (real Overture/OSM polygons) is densest along roads and canals, typical of volunteer-mapped coverage. (mock response)'
			: ' (mock response)';
		return prefix + body + suffix;
	}

	async function explain() {
		const map = mapStore.map;
		if (!map) return;
		shot = captureViewport(map, 1024);
		shotFailed = shot === null;
		// Camera at capture time, read unrounded from the map itself — boxes are
		// unprojected under exactly this camera when the claims arrive.
		capturedCamera = {
			center: map.getCenter().toArray() as [number, number],
			zoom: map.getZoom(),
			bearing: map.getBearing(),
			pitch: map.getPitch()
		};
		placed = [];
		visibleBoxes = new Set();
		evidenceError = null;

		const snapshot = buildContextSnapshot(mapStore, {
			activeDemo: page.params.demo ?? '',
			llmMode: llm.mode
		});
		const context = snapshot ? serializeForPrompt(snapshot, ['viewport', 'layers']) : '';

		const prose = run.run({
			system: systemPrompt(),
			maxTokens: verbosity === 'detailed' ? 800 : 400,
			messages: [
				{
					role: 'user',
					content: [
						...(shot
							? [{ type: 'image' as const, mediaType: 'image/jpeg', base64: shot.base64 }]
							: []),
						{
							type: 'text' as const,
							text:
								(shot
									? 'Explain what is in this map view.'
									: 'No screenshot available (canvas capture failed) — explain from metadata alone.') +
								`\n\nApp context:\n${context}`
						}
					]
				}
			],
			mock: { kind: 'fn', run: () => mockText() }
		});

		// Second structured call once the prose lands: claims with evidence boxes.
		if (shot) prose.then(() => extractEvidence()).catch(() => {});
	}
</script>

<OvertureScene />

{#if placed.length}
	<GeoJSONSource id="evidence-boxes" data={boxesFc}>
		<MapLayer
			spec={{
				id: 'evidence-boxes-fill',
				type: 'fill',
				source: 'evidence-boxes',
				paint: {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					'fill-color': confidenceColorExpr as any,
					'fill-opacity': 0.08
				}
			}}
			filter={visibleFilter}
			paint={fillEmphasis}
		/>
		<MapLayer
			spec={{
				id: 'evidence-boxes-line',
				type: 'line',
				source: 'evidence-boxes',
				paint: {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					'line-color': confidenceColorExpr as any,
					'line-width': 2.5,
					'line-dasharray': [2, 1.5]
				}
			}}
			filter={visibleFilter}
			paint={lineEmphasis}
		/>
	</GeoJSONSource>
{/if}

<OverlayPanel side="right" width="25rem" fill>
	<Panel title="Explain this view">
		{#snippet actions()}
			<Badge tone={llm.mode === 'mock' ? 'neutral' : 'primary'}>{llm.mode}</Badge>
		{/snippet}
		<p class="lead">
			Captures the viewport from the map canvas, pairs it with the context snapshot, and asks a
			multimodal model. The levers below rewrite the system prompt — the pipeline stays legible:
			what was captured is always shown.
		</p>

		<div class="levers">
			<Select
				label="verbosity"
				bind:value={verbosity}
				options={['terse', 'normal', 'detailed'].map((v) => ({ value: v, label: v }))}
			/>
			<Select
				label="confidence"
				bind:value={confidence}
				options={['calibrated', 'assertive', 'skeptical'].map((v) => ({ value: v, label: v }))}
			/>
			<Select
				label="focus"
				bind:value={focus}
				options={['describe', 'interpret', 'anomalies'].map((v) => ({ value: v, label: v }))}
			/>
			<Select
				label="audience"
				bind:value={audience}
				options={['analyst', 'policymaker', 'child'].map((v) => ({ value: v, label: v }))}
			/>
		</div>

		<Button variant="primary" onclick={explain} disabled={run.isStreaming || !mapStore.loaded}>
			{#if run.isStreaming}<Spinner size={12} />{/if}
			capture &amp; explain
		</Button>

		<details class="prompt-peek">
			<summary>system prompt this produces</summary>
			<pre>{systemPrompt()}</pre>
		</details>
	</Panel>

	{#if shot || shotFailed || run.content || run.error}
		<Panel title="Pipeline">
			{#if shot}
				<div class="label">captured viewport ({shot.width}×{shot.height}, jpeg)</div>
				<div class="thumb-wrap">
					<img class="thumb" src={shot.dataUrl} alt="captured map viewport" />
					{#each placed as c (c.idx)}
						{@const color = CONFIDENCE_COLORS[c.confidence]}
						<div
							class="ev-box"
							class:hot={hoveredClaim === c.idx}
							style:left="{c.bbox[0] * 100}%"
							style:top="{c.bbox[1] * 100}%"
							style:width="{(c.bbox[2] - c.bbox[0]) * 100}%"
							style:height="{(c.bbox[3] - c.bbox[1]) * 100}%"
							style:border-color={color}
							style:background="color-mix(in srgb, {color} {hoveredClaim === c.idx
								? 28
								: 8}%, transparent)"
							role="presentation"
							onmouseenter={() => (hoveredClaim = c.idx)}
							onmouseleave={() => (hoveredClaim = null)}
						>
							<span class="ev-n" style:background={color}>{c.idx + 1}</span>
						</div>
					{/each}
				</div>
			{:else if shotFailed}
				<p class="warn">
					Canvas capture failed (tile CORS / tainted canvas) — degraded to metadata-only request.
				</p>
			{/if}
			{#if run.error}
				<p class="error">{run.error}</p>
			{:else if run.content}
				<div class="answer">
					<StreamedText content={run.content} streaming={run.isStreaming} />
				</div>
			{/if}
		</Panel>
	{/if}

	{#if evidenceRunning || placed.length || evidenceError}
		<Panel title="Pointable evidence">
			{#snippet actions()}
				{#if evidenceRunning}<Spinner size={11} />{/if}
			{/snippet}
			{#if evidenceError}
				<p class="error">{evidenceError}</p>
			{:else if evidenceRunning}
				<p class="ev-note">extracting claims with image-space evidence boxes…</p>
			{:else}
				<div class="ev-controls">
					<button class="show-btn" onclick={() => (visibleBoxes = new Set(placed.map((p) => p.idx)))}>
						show all
					</button>
					<button class="show-btn" onclick={() => (visibleBoxes = new Set())}>hide all</button>
					{#if cameraMoved}
						<button class="show-btn fly" onclick={flyBack}>⤺ fly back to capture</button>
					{/if}
				</div>
				<ol class="claims" onmouseleave={() => (hoveredClaim = null)}>
					{#each placed as c (c.idx)}
						<li
							class="claim"
							class:hot={hoveredClaim === c.idx}
							onmouseenter={() => (hoveredClaim = c.idx)}
						>
							<span class="claim-n" style:color={CONFIDENCE_COLORS[c.confidence]}>{c.idx + 1}</span>
							<span class="claim-body">
								<span class="claim-text">{c.text}</span>
								<span class="claim-meta">
									<i class="swatch" style:background={CONFIDENCE_COLORS[c.confidence]}></i>
									{c.confidence}
									<button
										class="show-btn"
										title="toggle this box on the live map"
										onclick={() => toggleBox(c.idx)}
									>
										{visibleBoxes.has(c.idx) ? 'shown ✓' : 'show'}
									</button>
								</span>
							</span>
						</li>
					{/each}
				</ol>
				<div class="legend">
					{#each ['high', 'medium', 'low'] as const as level (level)}
						<span class="legend-chip">
							<i class="swatch" style:background={CONFIDENCE_COLORS[level]}></i>
							{level}
						</span>
					{/each}
				</div>
				<p class="ev-note">
					boxes are stored in map coordinates at arrival, so they render wherever the camera goes
					— color is confidence. Under pitch they are view-dependent approximations of the image
					region{cameraMoved ? ' · the camera has moved; fly back to see them as captured' : ''}.
				</p>
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
	.levers {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2) var(--space-3);
		margin-bottom: var(--space-3);
	}
	.prompt-peek {
		margin-top: var(--space-3);
	}
	.prompt-peek summary {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--tx-3);
		cursor: pointer;
	}
	.prompt-peek pre {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--tx-2);
		white-space: pre-wrap;
		background: var(--bg);
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		padding: var(--space-2);
		margin: var(--space-2) 0 0;
	}
	.thumb-wrap {
		position: relative;
		margin: var(--space-2) 0 var(--space-3);
	}
	.thumb {
		width: 100%;
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		display: block;
	}
	.ev-box {
		position: absolute;
		border: 1.5px solid var(--primary);
		border-radius: 2px;
		transition: background 120ms;
	}
	.ev-box.hot {
		z-index: 2;
	}
	.ev-n {
		position: absolute;
		top: -0.05rem;
		left: -0.05rem;
		font-family: var(--font-mono);
		font-size: 0.55rem;
		line-height: 1;
		padding: 0.1rem 0.2rem;
		background: var(--primary);
		color: #1a1a17;
		border-radius: 0 0 2px 0;
	}
	.ev-controls {
		display: flex;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.show-btn.fly {
		margin-left: auto;
		color: var(--primary);
	}
	.swatch {
		display: inline-block;
		width: 9px;
		height: 9px;
		border-radius: 2px;
		flex: none;
	}
	.legend {
		display: flex;
		gap: var(--space-3);
		margin-top: var(--space-2);
	}
	.legend-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-3);
	}
	.claims {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	.claim {
		display: flex;
		gap: var(--space-2);
		padding: 0.45rem 0;
		border-bottom: 1px solid var(--ui);
		cursor: default;
	}
	.claim:last-child {
		border-bottom: none;
	}
	.claim.hot {
		background: var(--bg-3);
	}
	.claim-n {
		flex: none;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--primary);
		padding-top: 0.1rem;
	}
	.claim-body {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.claim-text {
		font-size: 0.75rem;
		line-height: 1.45;
		color: var(--tx);
	}
	.claim-meta {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-3);
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.show-btn {
		background: none;
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: 0.58rem;
		color: var(--tx-2);
		padding: 0.1rem 0.35rem;
		cursor: pointer;
	}
	.show-btn:hover:not(:disabled) {
		border-color: var(--primary);
		color: var(--primary);
	}
	.show-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.ev-note {
		margin: var(--space-2) 0 0;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		line-height: 1.5;
		color: var(--tx-3);
	}
	.answer {
		border-top: 1px solid var(--ui);
		padding-top: var(--space-3);
	}
	.warn {
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		color: var(--warning-text);
	}
	.error {
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		color: var(--error-text);
	}
</style>
