<script lang="ts">
	import { mapStore } from '$lib/map/MapStore.svelte';
	import { llm } from '$lib/llm/provider.svelte';
	import { LlmRun } from '$lib/llm/run.svelte';
	import OverlayPanel from '$lib/shell/OverlayPanel.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Panel from '$lib/ui/Panel.svelte';
	import Spinner from '$lib/ui/Spinner.svelte';
	import { StreamingMarkdown as StreamedText } from '@wri-datalab/ui';
	import OvertureScene from '../shared/OvertureScene.svelte';
	import { FLOOD_LABELS, LANDUSE_LABELS, type FloodRisk } from '../shared/canTho';

	type Tier = 'place' | 'landuse' | 'flood' | 'water' | 'ground';

	interface MenuState {
		x: number;
		y: number;
		lngLat: [number, number];
		tier: Tier;
		props: Record<string, unknown> | null;
	}

	let menu = $state<MenuState | null>(null);
	let lastAction = $state<{ label: string; menu: MenuState } | null>(null);
	const run = new LlmRun();

	// Priority: the most specific real feature wins — a place dot over the land-use
	// polygon it sits on, land use over the (modelled) flood band, band over water.
	const QUERY_LAYERS: { id: string; tier: Tier }[] = [
		{ id: 'places-dots', tier: 'place' },
		{ id: 'landuse-fill', tier: 'landuse' },
		{ id: 'flood-zones', tier: 'flood' },
		{ id: 'water-fill', tier: 'water' }
	];

	$effect(() => {
		let disposed = false;
		mapStore.whenReady().then(() => {
			if (disposed) return;
			mapStore.scene.on('contextmenu', (e) => {
				e.preventDefault();
				const map = mapStore.map!;
				const layers = QUERY_LAYERS.map((l) => l.id).filter((id) => map.getLayer(id));
				// Pad the click point so 3px place dots are hittable.
				const pad = 4;
				const feats = map.queryRenderedFeatures(
					[
						[e.point.x - pad, e.point.y - pad],
						[e.point.x + pad, e.point.y + pad]
					],
					{ layers }
				);
				let tier: Tier = 'ground';
				let props: Record<string, unknown> | null = null;
				for (const q of QUERY_LAYERS) {
					const f = feats.find((x) => x.layer.id === q.id);
					if (f) {
						tier = q.tier;
						props = { ...f.properties };
						break;
					}
				}
				menu = { x: e.point.x, y: e.point.y, lngLat: [e.lngLat.lng, e.lngLat.lat], tier, props };
			});
			mapStore.scene.on('click', () => (menu = null));
		});
		return () => {
			disposed = true;
			menu = null;
		};
	});

	interface Item {
		label: string;
		ai: boolean;
		run: (m: MenuState) => void;
	}

	function aiAsk(label: string, question: string, m: MenuState, mockText: string) {
		lastAction = { label, menu: m };
		run.run({
			system:
				'You are a map assistant answering a right-click question. Use ONLY the provided feature ' +
				'and location context. 2-4 sentences, concrete, name the values you used.',
			messages: [
				{
					role: 'user',
					content:
						`${question}\n\nLocation: ${m.lngLat[1].toFixed(4)}, ${m.lngLat[0].toFixed(4)} (lat, lon)\n` +
						`Surface: ${m.tier}\nFeature properties: ${JSON.stringify(m.props ?? {})}`
				}
			],
			maxTokens: 350,
			mock: { kind: 'fn', run: () => mockText }
		});
	}

	function placeMock(m: MenuState, kind: 'explain' | 'confidence' | 'similar'): string {
		const p = m.props as { id?: string; name?: string; category?: string; basic_category?: string; confidence?: number };
		const cat = (p.basic_category ?? p.category ?? 'place').replaceAll('_', ' ');
		if (kind === 'explain') {
			return `“${p.name}” is a real Overture Maps place categorized as ${cat}, published with confidence ${p.confidence}. The point and its attributes come from the merged Meta/Microsoft/Foursquare place corpus (CDLA-Permissive) — not from this app's synthetic data. (mock response, composed from the actual feature you clicked)`;
		}
		if (kind === 'confidence') {
			return `Confidence ${p.confidence} is Overture's own score for whether this place exists and is operational — it aggregates source agreement and freshness across the contributing datasets. Scores in this extract were floored at 0.5; treat anything under ~0.7 as "verify before you route someone there". (mock response)`;
		}
		return `Finding places like “${p.name}” in view: same category (${cat}) and confidence within ±0.1 of ${p.confidence}. In live mode this would run a filter on the places layer and highlight the matches; the mock stops at describing the query it would build. (mock response)`;
	}

	function landuseMock(m: MenuState, kind: 'explain' | 'similar'): string {
		const p = m.props as { class?: string; subtype?: string };
		const lu = LANDUSE_LABELS[p.class ?? ''] ?? p.class;
		if (kind === 'explain') {
			return `This polygon is real Overture land use: class "${p.class}" (subtype ${p.subtype}) — ${lu?.toLowerCase()} mapped by OpenStreetMap contributors and republished under ODbL. Boundaries reflect what volunteers have traced; absence of a polygon means unmapped, not empty. (mock response, composed from the actual feature you clicked)`;
		}
		return `Finding land use like this in view: same class (${p.class}), optionally widened to its subtype (${p.subtype}). In live mode this would filter the land-use layer and highlight matches. (mock response)`;
	}

	function floodMock(m: MenuState): string {
		const p = m.props as { flood_risk?: FloodRisk; dist_min_m?: number; dist_max_m?: number };
		const risk = FLOOD_LABELS[p.flood_risk ?? 'low'] ?? p.flood_risk;
		return `Class **${risk}** here is MODELLED, not observed: this band covers land ${p.dist_min_m}–${p.dist_max_m} m from the Hậu River channel, and risk is assigned purely by that distance. It is a design-research stand-in — the land use and places around it are real Overture data, this overlay is not. (mock response)`;
	}

	function items(m: MenuState): Item[] {
		const common: Item[] = [
			{
				label: 'Copy coordinates',
				ai: false,
				run: (mm) => {
					navigator.clipboard.writeText(`${mm.lngLat[1].toFixed(5)}, ${mm.lngLat[0].toFixed(5)}`);
					menu = null;
				}
			},
			{
				label: 'Zoom here',
				ai: false,
				run: (mm) => {
					mapStore.flyTo({ center: mm.lngLat, zoom: mapStore.viewport.zoom + 1.5 }, 900);
					menu = null;
				}
			}
		];
		if (m.tier === 'place') {
			return [
				{
					label: 'Explain this place',
					ai: true,
					run: (mm) => {
						aiAsk('Explain this place', 'Explain this place.', mm, placeMock(mm, 'explain'));
						menu = null;
					}
				},
				{
					label: 'How sure is this data?',
					ai: true,
					run: (mm) => {
						aiAsk(
							'How sure is this data?',
							'What does this place’s confidence score mean?',
							mm,
							placeMock(mm, 'confidence')
						);
						menu = null;
					}
				},
				{
					label: 'Find similar in view',
					ai: true,
					run: (mm) => {
						aiAsk(
							'Find similar in view',
							'Describe how you would find similar places in the current view.',
							mm,
							placeMock(mm, 'similar')
						);
						menu = null;
					}
				},
				...common
			];
		}
		if (m.tier === 'landuse') {
			return [
				{
					label: 'Explain this land use',
					ai: true,
					run: (mm) => {
						aiAsk('Explain this land use', 'Explain this land-use polygon.', mm, landuseMock(mm, 'explain'));
						menu = null;
					}
				},
				{
					label: 'Find similar in view',
					ai: true,
					run: (mm) => {
						aiAsk(
							'Find similar in view',
							'Describe how you would find similar land use in the current view.',
							mm,
							landuseMock(mm, 'similar')
						);
						menu = null;
					}
				},
				...common
			];
		}
		if (m.tier === 'flood') {
			return [
				{
					label: 'Why this risk class?',
					ai: true,
					run: (mm) => {
						aiAsk('Why this risk class?', 'Why does this area have its flood-risk class?', mm, floodMock(mm));
						menu = null;
					}
				},
				...common
			];
		}
		if (m.tier === 'water') {
			return [
				{
					label: 'Describe hydrology here',
					ai: true,
					run: (mm) => {
						aiAsk(
							'Describe hydrology here',
							'Describe the hydrology at this point.',
							mm,
							'You clicked real Overture water — here the Hậu (Bassac) River, the southern of the two main Mekong distributaries, about 1.4 km wide at Cần Thơ. It is tidal despite being ~80 km from the sea, which is why the modelled flood bands track channel proximity so strongly: high tide plus high discharge is the compound-flood case. (mock response)'
						);
						menu = null;
					}
				},
				...common
			];
		}
		return [
			{
				label: 'Describe this area',
				ai: true,
				run: (mm) => {
					aiAsk(
						'Describe this area',
						'Describe this area.',
						mm,
						`No mapped feature at this exact point — the nearest context is the surrounding Mekong Delta landscape at ${mm.lngLat[1].toFixed(3)}, ${mm.lngLat[0].toFixed(3)}. In live mode I would combine basemap tile content with nearby feature statistics; unmapped gaps in the real Overture data are themselves worth knowing about. (mock response)`
					);
					menu = null;
				}
			},
			{
				label: 'What data covers this point?',
				ai: true,
				run: (mm) => {
					aiAsk(
						'What data covers this point?',
						'What data layers cover this point?',
						mm,
						'Coverage at this point: the Overture vector basemap (land, water, roads, buildings, divisions — streamed from PMTiles on S3), Esri satellite (hidden), real Overture land use and places, and the MODELLED flood bands within ~9 km of the river. No feature intersects the click, so feature-level context is empty. (mock response)'
					);
					menu = null;
				}
			},
			...common
		];
	}

	const TIER_LABEL: Record<Tier, string> = {
		place: 'place under cursor',
		landuse: 'land use under cursor',
		flood: 'flood band under cursor',
		water: 'water under cursor',
		ground: 'no feature under cursor'
	};
</script>

<!-- hover attributes off: this demo's identity IS right-click inspection -->
<OvertureScene hoverAttributes={false} />

{#if menu}
	<div class="menu" style:left="{menu.x}px" style:top="{menu.y}px">
		<div class="chips">
			<span class="chip tier">{TIER_LABEL[menu.tier]}</span>
			{#if menu.props?.name}<span class="chip">{menu.props.name}</span>{/if}
			{#if menu.props?.class}<span class="chip">{menu.props.class}</span>{/if}
			{#if menu.props?.basic_category}<span class="chip">{menu.props.basic_category}</span>{/if}
			{#if menu.props?.confidence}<span class="chip">conf {menu.props.confidence}</span>{/if}
			{#if menu.props?.flood_risk}<span class="chip">{menu.props.flood_risk} · modelled</span>{/if}
		</div>
		{#each items(menu) as item (item.label)}
			<button class="mi" class:ai={item.ai} onclick={() => item.run(menu!)}>
				{#if item.ai}<span class="spark">✦</span>{/if}
				{item.label}
			</button>
		{/each}
	</div>
{/if}

<OverlayPanel side="right" width="23rem">
	<Panel title="Context menu">
		{#snippet actions()}
			<Badge tone={llm.mode === 'mock' ? 'neutral' : 'primary'}>{llm.mode}</Badge>
		{/snippet}
		<p class="lead">
			<strong>Right-click the map.</strong> The menu is assembled from what is under the cursor —
			a real Overture place or land-use polygon, the modelled flood band, water, or bare ground
			each get different options. The chips at the top of the menu show exactly which context
			would be fed to the model: the menu is honest about what it knows.
		</p>
		<ul class="notes">
			<li>AI options (✦) stream answers composed from the clicked feature's actual attributes — even in mock mode.</li>
			<li>Plain actions (copy, zoom) mix into the same menu; AI is an option, not a mode.</li>
		</ul>
	</Panel>

	{#if lastAction}
		<Panel title={lastAction.label}>
			{#snippet actions()}
				{#if run.isStreaming}<Spinner size={11} />{/if}
			{/snippet}
			<div class="ctx-line">
				at {lastAction.menu.lngLat[1].toFixed(4)}, {lastAction.menu.lngLat[0].toFixed(4)} ·
				{TIER_LABEL[lastAction.menu.tier]}
			</div>
			{#if run.error}
				<p class="error">{run.error}</p>
			{:else}
				<StreamedText content={run.content} streaming={run.isStreaming} />
			{/if}
		</Panel>
	{/if}
</OverlayPanel>

<style>
	.menu {
		position: absolute;
		z-index: 40;
		min-width: 15rem;
		background: var(--bg-2);
		border: 1px solid var(--ui-2);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-default);
		padding: 0.3rem;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		padding: 0.25rem 0.35rem 0.4rem;
		border-bottom: 1px solid var(--ui);
		margin-bottom: 0.25rem;
	}
	.chip {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		color: var(--tx-3);
		background: var(--bg);
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		padding: 0.08rem 0.3rem;
	}
	.chip.tier {
		color: var(--primary);
		border-color: color-mix(in srgb, var(--primary) 40%, transparent);
	}
	.mi {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		border-radius: var(--radius-sm);
		padding: 0.35rem 0.5rem;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--tx);
		cursor: pointer;
	}
	.mi:hover {
		background: var(--bg-3);
	}
	.spark {
		color: var(--primary);
		font-size: 0.65rem;
	}
	.lead {
		margin: 0 0 var(--space-3);
		font-size: 0.78rem;
		line-height: 1.55;
		color: var(--tx-2);
	}
	.lead strong {
		color: var(--tx);
	}
	.notes {
		margin: 0;
		padding-left: 1rem;
		font-size: 0.72rem;
		line-height: 1.55;
		color: var(--tx-2);
	}
	.ctx-line {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-3);
		margin-bottom: var(--space-2);
	}
	.error {
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		color: var(--error-text);
	}
</style>
