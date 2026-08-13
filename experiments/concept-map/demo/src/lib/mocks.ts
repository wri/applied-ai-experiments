/**
 * Keyless-mode fixtures.
 *
 * Every runLLM call in this demo carries one of these. With no API key (or with
 * force-mock on) `runLLM` resolves the call from the spec instead of the network;
 * with a key it hits the provider and these are ignored. See
 * `packages/llm-lab/README.md` §"Per-request mocks" for the mechanism.
 *
 * Both fixtures resolve to a STRING that then travels the demo's normal path —
 * `parseStructured(GRAPH_SCHEMA)`, then `enforceIntegrity()` — so a fixture that
 * would fail the schema, or that references a node id that doesn't exist, fails
 * keylessly exactly as it would live.
 *
 * The interesting one is `expandMock`. A canned graph can only ever expand the
 * one node it was written for, but the expand prompt embeds the focal node's full
 * JSON record, so a `fn` spec can read the focal node back out and synthesise
 * children that connect to *it*. That makes every node on the map expandable with
 * no key — the thing a fixed recording could never do.
 */

import { lastUserText, type MockSpec } from '@wri-datalab/llm-lab';
import type { GraphData } from './graph/types';

function fenced(value: unknown): string {
	return '```json\n' + JSON.stringify(value, null, 2) + '\n```';
}

// --- Initial generate -----------------------------------------------------

/**
 * The default topic ("Climate finance for urban adaptation") in the Explainer
 * vocabulary: concept, mechanism, actor, outcome.
 */
const CLIMATE_FINANCE_MAP: GraphData = {
	nodes: [
		{
			id: 'adaptation_finance_gap',
			label: 'Adaptation finance gap',
			type: 'concept',
			description:
				'The shortfall between the finance cities receive for climate adaptation and what their adaptation plans require. The gap is widest for secondary cities with no direct access to international funds.',
			follow_up_questions: [
				'How is the gap actually measured?',
				'Which cities are furthest from their need?',
			],
		},
		{
			id: 'direct_access',
			label: 'Direct access',
			type: 'mechanism',
			description:
				'Arrangements that let a city receive climate finance without a national government intermediating. Rare in practice, because accreditation demands fiduciary capacity most municipalities lack.',
			follow_up_questions: ['What does accreditation require?'],
		},
		{
			id: 'sovereign_lending',
			label: 'Sovereign lending',
			type: 'mechanism',
			description:
				'The dominant channel: international funds lend to national governments, which on-lend or grant to cities. Adds delay and dilutes city control over what gets built.',
		},
		{
			id: 'municipal_creditworthiness',
			label: 'Municipal creditworthiness',
			type: 'concept',
			description:
				'Whether a city can borrow on its own balance sheet. Few secondary cities hold a credit rating, which closes off bond markets and most direct instruments at once.',
			follow_up_questions: ['What does it take to get a first rating?'],
		},
		{
			id: 'project_preparation',
			label: 'Project preparation',
			type: 'mechanism',
			description:
				'Turning an adaptation idea into a fundable proposal — feasibility, safeguards, co-financing. The stage where most city concepts stall, and the most under-funded part of the pipeline.',
		},
		{
			id: 'national_governments',
			label: 'National governments',
			type: 'actor',
			description:
				'Accredited to receive international climate finance and therefore the gatekeeper for most city funding. Their priorities set which cities and sectors advance.',
		},
		{
			id: 'city_governments',
			label: 'City governments',
			type: 'actor',
			description:
				'Hold the adaptation mandate and the local knowledge, but rarely the fiduciary standing or in-house capacity to access finance directly.',
		},
		{
			id: 'multilateral_funds',
			label: 'Multilateral funds',
			type: 'actor',
			description:
				'Climate funds and development banks that set accreditation rules and window design — the actor whose process changes could most quickly widen city access.',
		},
		{
			id: 'delivered_adaptation',
			label: 'Delivered adaptation',
			type: 'outcome',
			description:
				'Infrastructure and services actually built and maintained: drainage, cooling, coastal protection, early warning. The only outcome that reduces exposure.',
		},
		{
			id: 'stalled_pipeline',
			label: 'Stalled pipeline',
			type: 'outcome',
			description:
				'Concepts that never reach a funding decision. Consumes scarce city staff time and erodes political appetite for the next attempt.',
		},
	],
	edges: [
		{
			source: 'adaptation_finance_gap',
			target: 'project_preparation',
			relationship: 'widened by',
			explanation: 'Under-funded preparation means fewer concepts become fundable proposals.',
		},
		{
			source: 'sovereign_lending',
			target: 'national_governments',
			relationship: 'routed through',
			explanation: 'The dominant channel makes national government the intermediary by design.',
		},
		{
			source: 'national_governments',
			target: 'city_governments',
			relationship: 'on-lends to',
			explanation: 'Cities receive finance second-hand, with priorities already partly set.',
		},
		{
			source: 'municipal_creditworthiness',
			target: 'direct_access',
			relationship: 'enables',
			explanation: 'Without a rating or fiduciary capacity, direct instruments stay closed.',
		},
		{
			source: 'direct_access',
			target: 'city_governments',
			relationship: 'empowers',
			explanation: 'Direct access gives cities control over what gets built and when.',
		},
		{
			source: 'multilateral_funds',
			target: 'direct_access',
			relationship: 'gatekeeps',
			explanation: 'Accreditation rules set by the funds determine who can access directly.',
		},
		{
			source: 'project_preparation',
			target: 'delivered_adaptation',
			relationship: 'leads to',
			explanation: 'Preparation is the bottleneck between intent and built infrastructure.',
		},
		{
			source: 'project_preparation',
			target: 'stalled_pipeline',
			relationship: 'fails into',
			explanation: 'Concepts that cannot clear preparation become sunk staff cost.',
		},
		{
			source: 'stalled_pipeline',
			target: 'adaptation_finance_gap',
			relationship: 'reinforces',
			explanation: 'Fewer fundable proposals means less finance flows, widening the gap again.',
		},
		{
			source: 'city_governments',
			target: 'delivered_adaptation',
			relationship: 'delivers',
			explanation: 'Cities are the implementing actor once finance arrives.',
		},
	],
};

export const generateMock: MockSpec = {
	kind: 'match',
	cases: [
		{
			pattern: /climate finance|urban adaptation|adaptation finance/i,
			text: fenced(CLIMATE_FINANCE_MAP),
		},
	],
	// Any other topic: return the same shape but say so, rather than pretending
	// to have generated a map about something we have no fixture for.
	fallback: fenced({
		nodes: [
			{
				id: 'keyless_mode',
				label: 'Keyless mode',
				type: 'concept',
				description:
					'This demo has no fixture for this topic, so it is showing a placeholder map. Add an API key in settings to generate a real map for any topic, or try the preset topic.',
				follow_up_questions: ['What topics have fixtures?'],
			},
			{
				id: 'preset_topic',
				label: 'Preset topic',
				type: 'mechanism',
				description:
					'"Climate finance for urban adaptation" has a full committed fixture — ten nodes across concepts, mechanisms, actors and outcomes.',
			},
			{
				id: 'expansion_works',
				label: 'Expansion still works',
				type: 'outcome',
				description:
					'Node expansion is computed from whichever node you click, so it works keylessly on any node of any map — including this one.',
			},
		],
		edges: [
			{
				source: 'keyless_mode',
				target: 'preset_topic',
				relationship: 'suggests',
				explanation: 'The preset topic is the one with a hand-written fixture.',
			},
			{
				source: 'keyless_mode',
				target: 'expansion_works',
				relationship: 'still allows',
				explanation: 'Expansion is synthesised from the focal node rather than canned.',
			},
		],
	} satisfies GraphData),
};

// --- Node expansion -------------------------------------------------------

/** Pull the focal node's record back out of the expand prompt. */
function readFocalNode(prompt: string): { id: string; label: string; type: string } | null {
	// buildExpandPrompt embeds `JSON.stringify(focal, null, 2)` after a header line.
	const block = prompt.split('Focal node to expand (full record):')[1];
	if (!block) return null;
	const start = block.indexOf('{');
	if (start === -1) return null;
	// Walk braces to find the matching close, so a nested object can't truncate it.
	let depth = 0;
	for (let i = start; i < block.length; i++) {
		if (block[i] === '{') depth++;
		else if (block[i] === '}') {
			depth--;
			if (depth === 0) {
				try {
					const parsed = JSON.parse(block.slice(start, i + 1));
					if (typeof parsed?.id === 'string') {
						return {
							id: parsed.id,
							label: typeof parsed.label === 'string' ? parsed.label : parsed.id,
							type: typeof parsed.type === 'string' ? parsed.type : 'concept',
						};
					}
				} catch {
					return null;
				}
				return null;
			}
		}
	}
	return null;
}

/** Node ids already on the map, so synthesised ids can't collide. */
function readExistingIds(prompt: string): Set<string> {
	const block = prompt.split('Current graph nodes (id: label):')[1]?.split('\n\n')[0] ?? '';
	const ids = block
		.split('\n')
		.map((line) => line.split(':')[0].trim())
		.filter(Boolean);
	return new Set(ids);
}

/**
 * Three children per expansion, phrased so they read as a genuine deepening of
 * the focal node rather than filler. Deliberately generic: the point of keyless
 * mode here is that the *interaction* works on any node, not that the content is
 * as good as a live model's.
 */
const CHILD_SHAPES = [
	{
		suffix: 'constraint',
		label: (l: string) => `What limits ${l.toLowerCase()}`,
		relationship: 'constrains',
		description: (l: string) =>
			`The binding constraint on ${l.toLowerCase()} — the thing that has to move before anything else here changes. Add an API key to have a model name the real one.`,
		explanation: (l: string) => `Identifies what currently holds ${l.toLowerCase()} back.`,
	},
	{
		suffix: 'lever',
		label: (l: string) => `Lever on ${l.toLowerCase()}`,
		relationship: 'shifts',
		description: (l: string) =>
			`An intervention point that changes ${l.toLowerCase()} rather than working around it. Add an API key for a topic-specific answer.`,
		explanation: (l: string) => `A way to act on ${l.toLowerCase()} directly.`,
	},
	{
		suffix: 'evidence',
		label: (l: string) => `Evidence for ${l.toLowerCase()}`,
		relationship: 'supports',
		description: (l: string) =>
			`What would have to be true for ${l.toLowerCase()} to hold, and how you would check it. Add an API key for real sources.`,
		explanation: (l: string) => `Grounds the claim that ${l.toLowerCase()} matters.`,
	},
];

export const expandMock: MockSpec = {
	kind: 'fn',
	run: (request) => {
		// The expand prompt is the last user message; lastUserText handles the
		// string-vs-content-parts shapes for us.
		const prompt = lastUserText(request);
		const focal = readFocalNode(prompt);
		if (!focal) {
			// No focal node found — return an empty-but-valid graph rather than
			// inventing edges that enforceIntegrity would drop anyway.
			return fenced({ nodes: [], edges: [] } satisfies GraphData);
		}

		const existing = readExistingIds(prompt);
		const nodes: GraphData['nodes'] = [];
		const edges: GraphData['edges'] = [];

		for (const shape of CHILD_SHAPES) {
			let id = `${focal.id}_${shape.suffix}`;
			let n = 2;
			while (existing.has(id)) id = `${focal.id}_${shape.suffix}_${n++}`;
			existing.add(id);

			nodes.push({
				id,
				label: shape.label(focal.label),
				// Reuse the focal node's type so the new nodes stay inside the
				// active map style's vocabulary.
				type: focal.type,
				description: shape.description(focal.label),
			});
			edges.push({
				source: id,
				target: focal.id,
				relationship: shape.relationship,
				explanation: shape.explanation(focal.label),
			});
		}

		return fenced({ nodes, edges } satisfies GraphData);
	},
};

/** Repair should never fire keylessly — the fixtures are schema-valid. */
export const repairMock: MockSpec = {
	kind: 'text',
	text: fenced({ nodes: [], edges: [] } satisfies GraphData),
};
