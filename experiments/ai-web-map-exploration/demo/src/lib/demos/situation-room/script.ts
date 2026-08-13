import type { Schema } from '$lib/llm/types';
import type { AgentStore, AgentTask } from '$lib/agents/AgentStore.svelte';
import type { SimEvent } from '$lib/agents/sim.svelte';
import type { MockSpec } from '$lib/llm/types';

// --- planner ---

export interface PlanNode {
	id: string;
	agent: 'retrieval' | 'analysis' | 'cartography' | 'critique';
	description: string;
	dependsOn: string[];
	produces: string;
}

export interface SituationPlan {
	objective: string;
	tasks: PlanNode[];
}

export const PLAN_SCHEMA: Schema = {
	type: 'object',
	required: ['objective', 'tasks'],
	additionalProperties: false,
	properties: {
		objective: { type: 'string', maxLength: 200 },
		tasks: {
			type: 'array',
			minItems: 3,
			maxItems: 6,
			items: {
				type: 'object',
				required: ['id', 'agent', 'description', 'dependsOn', 'produces'],
				additionalProperties: false,
				properties: {
					id: { type: 'string', maxLength: 20 },
					agent: { enum: ['retrieval', 'analysis', 'cartography', 'critique'] },
					description: { type: 'string', maxLength: 200 },
					dependsOn: { type: 'array', items: { type: 'string' }, maxItems: 4 },
					produces: { type: 'string', maxLength: 100 }
				}
			}
		}
	}
};

export const CANNED_PLAN: SituationPlan = {
	objective: 'Assess flood exposure for smallholder farms in the lower Zambezi and produce a verifiable briefing.',
	tasks: [
		{
			id: 'retrieve',
			agent: 'retrieval',
			description: 'Assemble hydrology (river geometry, inundation scenarios), the smallholder farm registry, and land-tenure context for the lower Zambezi.',
			dependsOn: [],
			produces: 'hydrology + farm layers'
		},
		{
			id: 'analyze',
			agent: 'analysis',
			description: 'Intersect farm sites with current and projected inundation extents; compute exposure counts, crop mix, and household estimates.',
			dependsOn: ['retrieve'],
			produces: 'exposure statistics'
		},
		{
			id: 'compose',
			agent: 'cartography',
			description: 'Compose the map series: overview, current-exposure close-up, and projected-scenario comparison, each as a restorable map state.',
			dependsOn: ['analyze'],
			produces: 'linked map states'
		},
		{
			id: 'redteam',
			agent: 'critique',
			description: 'Red-team every claim against sources: layer dates, model assumptions, spatial accuracy; attach uncertainty notes to the briefing.',
			dependsOn: ['analyze', 'compose'],
			produces: 'audit trail + caveats'
		}
	]
};

export function plannerMock(): MockSpec {
	return { kind: 'json', value: CANNED_PLAN };
}

// --- exposure numbers, computed from the real data so prose can't drift ---

export interface ExposureNumbers {
	total: number;
	exposedNow: number;
	projected: number;
	households: number;
}

/** Fallback matching zambezi-farms.geojson if the file hasn't loaded yet. */
export const DEFAULT_NUMBERS: ExposureNumbers = {
	total: 172,
	exposedNow: 72,
	projected: 139,
	households: 1600
};

export function computeNumbers(fc: GeoJSON.FeatureCollection): ExposureNumbers {
	let exposedNow = 0;
	let projected = 0;
	let households = 0;
	for (const f of fc.features) {
		const exp = f.properties?.flood_exposure;
		if (exp === 'high') {
			exposedNow++;
			households += Number(f.properties?.households ?? 0);
		}
		if (exp === 'high' || exp === 'medium') projected++;
	}
	return {
		total: fc.features.length,
		exposedNow,
		projected,
		households: Math.round(households / 100) * 100
	};
}

// --- execution (simulated agents, structured by the model's plan) ---

export interface MapCite {
	label: string;
	camera: { center: [number, number]; zoom: number };
	flood: 'none' | 'current' | 'projected' | 'both';
	farms: 'none' | 'all' | 'exposed';
}

export interface BriefingBlock {
	id: string;
	agent: string;
	kind: 'headline' | 'finding' | 'uncertainty';
	text: string;
	cite?: MapCite;
	/** Appended in place by the critique agent — the card visibly changes. */
	revision?: string;
}

export interface SituationHooks {
	addBlock: (b: BriefingBlock) => void;
	reviseBlock: (id: string, revision: string) => void;
	setLayers: (flood: MapCite['flood'], farms: MapCite['farms']) => void;
	moveCamera: (camera: MapCite['camera']) => void;
	showHeadline: () => void;
}

/** Per-role AOIs on the lower Zambezi (reused for any plan shape). */
const ROLE_AOI: Record<PlanNode['agent'], [number, number, number, number]> = {
	retrieval: [34.9, -18.65, 36.5, -17.5],
	analysis: [35.0, -18.55, 36.3, -17.6],
	cartography: [34.9, -18.65, 36.5, -17.5],
	critique: [34.9, -18.65, 36.5, -17.5]
};

const ROLE_NAMES: Record<PlanNode['agent'], string> = {
	retrieval: 'Retrieval agent',
	analysis: 'Analysis agent',
	cartography: 'Cartography agent',
	critique: 'Critique agent'
};

/** One AgentTask per plan node — store ids ARE plan ids, so live plans resolve. */
export function tasksFromPlan(plan: SituationPlan): AgentTask[] {
	return plan.tasks.map((t) => ({
		id: t.id,
		name: ROLE_NAMES[t.agent],
		role: t.agent,
		description: t.description,
		status: 'queued' as const,
		aoi: ROLE_AOI[t.agent],
		assets: [],
		log: [],
		dependsOn: t.dependsOn.length ? [...t.dependsOn] : undefined
	}));
}

const ROLE_DURATION: Record<PlanNode['agent'], number> = {
	retrieval: 3800,
	analysis: 4800,
	cartography: 3000,
	critique: 4800
};

interface Slot {
	start: number;
	end: number;
}

/**
 * Schedule tasks from the plan's dependsOn graph (Kahn-style passes). A task
 * starts 400ms after its last dependency finishes; independent tasks genuinely
 * overlap. Unknown dependency ids are ignored; cycles degrade to "independent"
 * with a console.warn — live plans can be malformed and must never throw.
 */
function schedule(plan: SituationPlan): Map<string, Slot> {
	const byId = new Set(plan.tasks.map((t) => t.id));
	const slots = new Map<string, Slot>();
	let remaining = [...plan.tasks];
	let rootStagger = 0;
	let guard = plan.tasks.length + 1;
	while (remaining.length && guard-- > 0) {
		let ready = remaining.filter((t) =>
			t.dependsOn.every((d) => slots.has(d) || !byId.has(d) || d === t.id)
		);
		if (!ready.length) {
			console.warn('situation-room: dependency cycle in plan — treating remaining tasks as independent');
			ready = remaining;
		}
		for (const t of ready) {
			const depEnds = t.dependsOn.filter((d) => slots.has(d)).map((d) => slots.get(d)!.end);
			const start = depEnds.length ? Math.max(...depEnds) + 400 : 400 + rootStagger++ * 600;
			slots.set(t.id, { start, end: start + ROLE_DURATION[t.agent] });
		}
		remaining = remaining.filter((t) => !slots.has(t.id));
	}
	return slots;
}

/**
 * Build the execution timeline from the model's plan: structure, dependencies
 * and timing come from the plan; the finding prose is canned simulation
 * templated with numbers computed from the real farm data.
 */
export function buildTimelineFromPlan(
	plan: SituationPlan,
	store: AgentStore,
	hooks: SituationHooks,
	n: ExposureNumbers
): SimEvent[] {
	const slots = schedule(plan);
	const events: SimEvent[] = [];

	// generic lifecycle per task
	for (const t of plan.tasks) {
		const slot = slots.get(t.id);
		if (!slot) continue;
		events.push(
			{
				at: slot.start,
				run: () => {
					store.setStatus(t.id, 'working');
					store.appendLog(t.id, `claimed: ${t.description.slice(0, 80)}${t.description.length > 80 ? '…' : ''}`);
				}
			},
			{
				at: (slot.start + slot.end) / 2,
				run: () => store.appendLog(t.id, `producing: ${t.produces}`)
			},
			{ at: slot.end, run: () => store.setStatus(t.id, 'done') }
		);
	}

	// content beats, keyed by role (attached to the first task of each role)
	const first = (role: PlanNode['agent']) => plan.tasks.find((t) => t.agent === role);
	const pctNow = Math.round((n.exposedNow / n.total) * 100);
	const pctProjected = Math.round((n.projected / n.total) * 100);
	const growthPct = Math.round((n.projected / n.exposedNow - 1) * 100);

	const retrieval = first('retrieval');
	if (retrieval) {
		const s = slots.get(retrieval.id)!;
		events.push(
			{
				at: s.start + 1200,
				run: () => {
					store.appendLog(retrieval.id, 'river geometry + 2 inundation scenarios loaded');
					hooks.setLayers('current', 'none');
					store.attachAsset(retrieval.id, { id: 'hydro', name: 'Hydrology layers', kind: 'layer' });
				}
			},
			{
				at: s.end - 600,
				run: () => {
					store.appendLog(retrieval.id, `farm registry: ${n.total} validated smallholder sites`);
					hooks.setLayers('current', 'all');
					store.attachAsset(retrieval.id, { id: 'farms', name: 'Farm registry', kind: 'layer' });
				}
			}
		);
	}

	const analysis = first('analysis');
	if (analysis) {
		const s = slots.get(analysis.id)!;
		events.push(
			{
				at: s.start + 600,
				run: () => store.appendLog(analysis.id, 'intersecting farm sites with current extent')
			},
			{
				at: s.start + 2400,
				run: () => {
					store.appendLog(analysis.id, `current: ${n.exposedNow}/${n.total} sites exposed (~${n.households.toLocaleString()} households)`);
					hooks.showHeadline();
					hooks.moveCamera({ center: [35.9, -18.25], zoom: 8.6 });
					hooks.addBlock({
						id: 'b1',
						agent: 'analysis',
						kind: 'finding',
						text: `${n.exposedNow} of ${n.total} registered smallholder sites (~${pctNow}%) intersect the current modelled inundation extent — roughly ${n.households.toLocaleString()} households, concentrated on the right bank between Caia and the delta.`,
						cite: {
							label: 'current exposure',
							camera: { center: [35.9, -18.25], zoom: 8.6 },
							flood: 'current',
							farms: 'exposed'
						}
					});
				}
			},
			{
				at: s.end - 300,
				run: () => {
					store.appendLog(analysis.id, `projected: exposure grows to ${n.projected} sites (+${growthPct}%)`);
					hooks.addBlock({
						id: 'b2',
						agent: 'analysis',
						kind: 'finding',
						text: `Under the projected scenario exposure grows to ${n.projected} sites (+${growthPct}%). The growth is not uniform: maize clusters on the low terraces account for most of the newly exposed households.`,
						cite: {
							label: 'projected scenario',
							camera: { center: [35.6, -18.05], zoom: 8.2 },
							flood: 'both',
							farms: 'all'
						}
					});
					store.attachAsset(analysis.id, { id: 'stats', name: 'Exposure stats', kind: 'stats' });
				}
			}
		);
	}

	const cartography = first('cartography');
	if (cartography) {
		const s = slots.get(cartography.id)!;
		events.push(
			{
				at: s.start + 800,
				run: () => store.appendLog(cartography.id, 'composing 3-sheet map series with restorable states')
			},
			{
				at: s.end - 300,
				run: () => {
					hooks.moveCamera({ center: [35.65, -18.05], zoom: 7.6 });
					hooks.addBlock({
						id: 'b3',
						agent: 'cartography',
						kind: 'finding',
						text: 'Map series composed: basin overview, current-exposure close-up, and scenario comparison. Each citation in this briefing restores the exact map state the claim was made against.',
						cite: {
							label: 'basin overview',
							camera: { center: [35.65, -18.05], zoom: 7.6 },
							flood: 'current',
							farms: 'all'
						}
					});
					store.attachAsset(cartography.id, { id: 'series', name: 'Map series', kind: 'map-state' });
				}
			}
		);
	}

	const critique = first('critique');
	const lastEnd = Math.max(...[...slots.values()].map((s) => s.end));
	if (critique) {
		const s = slots.get(critique.id)!;
		events.push(
			{
				at: s.start + 800,
				run: () => store.appendLog(critique.id, 'checking model assumptions and layer provenance')
			},
			{
				at: s.start + 1800,
				run: () => {
					store.appendLog(critique.id, 'flag: 18 unvalidated registry sites excluded from exposure counts');
					hooks.reviseBlock(
						'b1',
						`Critique: 18 unvalidated registry sites were excluded — current exposure could reach ~${n.exposedNow + 7} sites (est.) if they validate.`
					);
				}
			},
			{
				at: s.start + 2900,
				run: () => {
					store.appendLog(critique.id, 'flag: inundation model excludes dam release schedules');
					hooks.moveCamera({ center: [35.2, -17.8], zoom: 9 });
					hooks.addBlock({
						id: 'b4',
						agent: 'critique',
						kind: 'uncertainty',
						text: 'Caveats: (1) the inundation model ignores upstream dam release schedules — treat the projected scenario as a lower bound during managed releases; (2) the farm registry is 9 days old; 18 unvalidated sites were excluded and could add up to 11% to exposure counts.',
						cite: {
							label: 'flagged reach',
							camera: { center: [35.2, -17.8], zoom: 9 },
							flood: 'projected',
							farms: 'exposed'
						}
					});
				}
			},
			{
				at: s.end - 200,
				run: () => {
					store.appendLog(critique.id, 'sign-off: claims consistent with sources, caveats attached');
					store.attachAsset(critique.id, { id: 'audit', name: 'Audit notes', kind: 'notes' });
					hooks.addBlock({
						id: 'b5',
						agent: 'critique',
						kind: 'headline',
						text: `Bottom line: roughly ${pctNow}% of registered smallholder farms in the lower Zambezi are exposed today, rising to ~${pctProjected}% in the projected scenario — verified against sources, with two caveats attached above.`
					});
				}
			}
		);
	} else {
		// no critique task in the plan: still close with a headline, unverified
		events.push({
			at: lastEnd + 300,
			run: () =>
				hooks.addBlock({
					id: 'b5',
					agent: 'analysis',
					kind: 'headline',
					text: `Bottom line: roughly ${pctNow}% of registered smallholder farms are exposed today, rising to ~${pctProjected}% projected. No critique agent was planned — these claims are unverified.`
				})
		});
	}

	return events;
}
