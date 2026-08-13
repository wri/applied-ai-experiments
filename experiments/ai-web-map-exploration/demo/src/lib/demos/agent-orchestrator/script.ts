import type { AgentTask } from '$lib/agents/AgentStore.svelte';
import type { AgentStore } from '$lib/agents/AgentStore.svelte';
import type { SimEvent } from '$lib/agents/sim.svelte';

export type FloodState = 'none' | 'current' | 'projected' | 'both';
export type FarmState = 'none' | 'all' | 'exposed';

/** Script → demo callbacks: the timeline drives real map layers through these. */
export interface OrchestratorHooks {
	setLayers: (flood: FloodState, farms: FarmState) => void;
	/** Briefly highlight a dependsOn edge while an artifact hands off. */
	setHandoff: (edge: { from: string; to: string } | null) => void;
}

export const TASKS: AgentTask[] = [
	{
		id: 'hydro',
		name: 'Hydrology retrieval',
		role: 'retrieval',
		description: 'Assemble river geometry, gauge series, and modelled inundation extents.',
		status: 'queued',
		aoi: [34.9, -18.2, 35.7, -17.5],
		assets: [],
		log: []
	},
	{
		id: 'farms',
		name: 'Farm registry sweep',
		role: 'survey',
		description: 'Pull smallholder registry points and validate coordinates against imagery.',
		status: 'queued',
		aoi: [35.3, -18.45, 36.1, -17.85],
		assets: [],
		log: []
	},
	{
		id: 'inundation',
		name: 'Inundation model run',
		role: 'analysis',
		description: 'Run the flood-extent model for current and projected scenarios.',
		status: 'queued',
		aoi: [35.0, -18.55, 36.3, -17.6],
		assets: [],
		log: [],
		dependsOn: ['hydro']
	},
	{
		id: 'exposure',
		name: 'Exposure map series',
		role: 'cartography',
		description: 'Compose the farm-exposure map series from analysis outputs.',
		status: 'queued',
		aoi: [35.4, -18.65, 36.45, -18.0],
		assets: [],
		log: [],
		dependsOn: ['inundation', 'farms']
	},
	{
		id: 'audit',
		name: 'Source audit',
		role: 'critique',
		description: 'Red-team every layer: provenance, dates, spatial accuracy.',
		status: 'queued',
		aoi: [34.95, -18.6, 36.4, -17.55],
		assets: [],
		log: [],
		dependsOn: ['exposure']
	}
];

/**
 * ~42s scripted timeline. Numbers match zambezi-farms.geojson (172 validated
 * sites, 72 high exposure now, 139 high+medium projected). The beat to watch:
 * at ~30s the audit agent bounces the map series back to cartography — a
 * visible column move on the kanban and an AOI recolor on the map — and the
 * revised artifact lands as `map-series-v2`.
 */
export function buildTimeline(store: AgentStore, hooks: OrchestratorHooks): SimEvent[] {
	const s = store;
	return [
		{ at: 400, run: () => s.setStatus('hydro', 'working') },
		{ at: 500, run: () => s.appendLog('hydro', 'claimed; querying hydrology catalog (3 sources)') },
		{ at: 1400, run: () => s.setStatus('farms', 'working') },
		{ at: 1600, run: () => s.appendLog('farms', 'registry API: 190 candidate records, deduplicating') },
		{ at: 2600, run: () => s.appendLog('hydro', 'river centerline + channel polygons retrieved (1:250k)') },
		{
			at: 3800,
			run: () =>
				s.appendLog(
					'hydro',
					'2 inundation scenarios loaded: current (gauge-driven), projected (climate-adjusted)'
				)
		},
		{
			at: 4400,
			run: () => {
				s.attachAsset('hydro', {
					id: 'river-geom',
					name: 'Zambezi geometry',
					kind: 'layer',
					detail: 'centerline + channel',
					payload: {
						type: 'notes',
						markdown:
							'## Sources\n- River centerline: national hydrology atlas, 1:250k\n- Channel polygons: same atlas, generalized\n- Gauge series: 3 stations, hourly, 14-day window'
					}
				});
				s.attachAsset('hydro', {
					id: 'flood-extent',
					name: 'Inundation extents',
					kind: 'map-state',
					detail: 'current + projected scenarios',
					payload: {
						type: 'map-state',
						camera: { center: [35.6, -18.05], zoom: 8 },
						layers: { flood: 'current', farms: 'none' },
						note: 'retrieval frame: current extent over the studied reach'
					}
				});
				hooks.setLayers('current', 'none');
			}
		},
		{ at: 5200, run: () => s.setStatus('hydro', 'review') },
		{
			at: 6200,
			run: () =>
				s.appendLog('farms', 'coordinate validation against imagery: 172 confirmed, 18 dropped (offset > 250 m)')
		},
		{
			at: 7000,
			run: () => {
				s.attachAsset('farms', {
					id: 'farm-points',
					name: 'Smallholder sites',
					kind: 'layer',
					detail: '172 validated points',
					payload: {
						type: 'stats',
						rows: [
							['candidates', '190'],
							['validated', '172'],
							['dropped', '18'],
							['high exposure', '72'],
							['medium exposure', '67']
						],
						caption: 'validation pass against latest imagery, offsets > 250 m dropped'
					}
				});
				hooks.setLayers('current', 'all');
			}
		},
		{ at: 7800, run: () => s.setStatus('farms', 'review') },
		{
			at: 8600,
			run: () => {
				s.appendLog('inundation', 'dependencies met (hydro) — starting model run');
				s.setStatus('inundation', 'working');
				hooks.setHandoff({ from: 'hydro', to: 'inundation' });
			}
		},
		{ at: 10600, run: () => hooks.setHandoff(null) },
		{ at: 11500, run: () => s.appendLog('inundation', 'current scenario: 72/172 sites intersect extent') },
		{
			at: 13500,
			run: () =>
				s.appendLog(
					'inundation',
					'projected scenario: 139 sites (+93%), growth concentrated on right-bank terraces'
				)
		},
		{
			at: 14500,
			run: () =>
				s.attachAsset('inundation', {
					id: 'exposure-stats',
					name: 'Exposure statistics',
					kind: 'stats',
					detail: '72 current / 139 projected exposed sites',
					payload: {
						type: 'stats',
						rows: [
							['sites validated', '172'],
							['exposed (current)', '72'],
							['exposed (projected)', '139 (+93%)'],
							['households affected', '~1,600'],
							['share of registry', '42% → 81%']
						],
						caption: 'intersection of validated sites with modelled extents'
					}
				})
		},
		{ at: 15200, run: () => { s.setStatus('hydro', 'done'); s.setStatus('inundation', 'review'); } },
		{ at: 16500, run: () => s.setStatus('farms', 'done') },
		{
			at: 17500,
			run: () => {
				s.appendLog('exposure', 'inputs ready (inundation + farms) — composing series');
				s.setStatus('exposure', 'working');
				hooks.setHandoff({ from: 'farms', to: 'exposure' });
			}
		},
		{ at: 19500, run: () => hooks.setHandoff(null) },
		{ at: 21000, run: () => s.appendLog('exposure', 'sheet 1/3: basin overview at 1:750k') },
		{
			at: 23000,
			run: () => {
				s.attachAsset('exposure', {
					id: 'map-series',
					name: 'Exposure map series',
					kind: 'map-state',
					detail: '3 sheets, styled + annotated',
					payload: {
						type: 'map-state',
						camera: { center: [35.65, -18.05], zoom: 7.6 },
						layers: { flood: 'both', farms: 'exposed' },
						note: 'sheet 1 of 3 — both scenarios, exposed sites only'
					}
				});
				hooks.setLayers('both', 'exposed');
			}
		},
		{ at: 24000, run: () => { s.setStatus('inundation', 'done'); s.setStatus('exposure', 'review'); } },
		{ at: 26000, run: () => { s.setStatus('audit', 'working'); s.appendLog('audit', 'checking provenance: registry 9 days old — pass'); } },
		{ at: 28500, run: () => s.appendLog('audit', 'checking model assumptions: dam release schedules NOT represented') },
		{
			at: 30500,
			run: () => {
				// the complication: critique bounces cartography back to work
				s.appendLog('audit', 'FLAG: series presents projected extent as upper bound — bouncing to cartography');
				s.setStatus('exposure', 'working');
				s.appendLog('exposure', 'returned by critique: annotate dam-release caveat');
			}
		},
		{
			at: 33500,
			run: () =>
				s.appendLog('exposure', "sheets re-annotated: projected extent labelled 'lower bound during managed releases'")
		},
		{
			at: 34500,
			run: () => {
				s.attachAsset('exposure', {
					id: 'map-series-v2',
					name: 'Exposure map series (rev 2)',
					kind: 'map-state',
					detail: 'caveat annotation added',
					payload: {
						type: 'map-state',
						camera: { center: [35.65, -18.05], zoom: 7.6 },
						layers: { flood: 'both', farms: 'exposed' },
						note: 'rev 2 — projected extent annotated as lower bound during managed dam releases'
					}
				});
				s.setStatus('exposure', 'review');
			}
		},
		{ at: 36500, run: () => { s.appendLog('audit', 're-review: caveat present — pass'); s.setStatus('exposure', 'done'); } },
		{
			at: 38500,
			run: () =>
				s.attachAsset('audit', {
					id: 'audit-notes',
					name: 'Red-team notes',
					kind: 'notes',
					detail: '2 passes, 1 flag resolved',
					payload: {
						type: 'notes',
						markdown:
							'## Red-team notes\n- **pass** — registry freshness (9 days)\n- **pass** — spatial accuracy (±40 m against imagery)\n- **flag → resolved** — dam-release caveat now annotated on sheets 2–3'
					}
				})
		},
		{ at: 40500, run: () => s.setStatus('audit', 'review') },
		{ at: 42000, run: () => { s.appendLog('audit', 'sign-off recorded'); s.setStatus('audit', 'done'); } }
	];
}
