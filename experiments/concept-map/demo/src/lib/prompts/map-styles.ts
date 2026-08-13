import { GRAPH_SCHEMA } from '../graph/types';

export interface MapStyle {
	id: string;
	name: string;
	description: string;
	systemPrompt: string;
}

const SHARED_RULES = [
	'You generate concept maps as graph data. You never write prose for humans — you produce data for a renderer.',
	'Return ONLY a JSON object conforming to this JSON Schema. No prose, no fences.',
	'',
	JSON.stringify(GRAPH_SCHEMA, null, 2),
	'',
	'Rules:',
	'- For an initial map, produce 8-14 nodes. Quality of structure beats coverage.',
	'- Node ids are snake_case and unique. Labels are at most 4 words.',
	'- Every edge must connect two node ids that exist in the "nodes" array. No dangling edges.',
	'- "relationship" is at most 3 words. "explanation" is one concrete sentence.',
	'- Prefer a connected graph: avoid isolated nodes unless the topic truly demands it.',
].join('\n');

function buildSystemPrompt(styleInstructions: string): string {
	return `${SHARED_RULES}\n\n${styleInstructions}`;
}

export const MAP_STYLES: MapStyle[] = [
	{
		id: 'explainer',
		name: 'Explainer',
		description: 'Key concepts and how they relate — a map for learning the topic',
		systemPrompt: buildSystemPrompt(
			[
				'Style: EXPLAINER map. Surface the key concepts of the topic and how they relate, so a newcomer can learn the territory.',
				'Use node types: concept, mechanism, actor, outcome.',
				'Edges should explain the topic: how mechanisms connect concepts to outcomes, which actors drive what.',
			].join('\n')
		),
	},
	{
		id: 'stakeholder',
		name: 'Stakeholder',
		description: 'Organizations, actors, incentives, and where they conflict',
		systemPrompt: buildSystemPrompt(
			[
				'Style: STAKEHOLDER map. Map the organizations and actors around the topic, their incentives, and where interests collide.',
				'Use node types: actor, institution, incentive, conflict.',
				'Edges should capture influence, funding, alignment, and tension between stakeholders.',
			].join('\n')
		),
	},
	{
		id: 'causal',
		name: 'Causal',
		description: 'Drivers, outcomes, feedback loops, and risks',
		systemPrompt: buildSystemPrompt(
			[
				'Style: CAUSAL map. Map the causal structure of the topic: what drives what, where feedback loops close, and what could go wrong.',
				'Use node types: driver, outcome, feedback, risk.',
				'Use directional relationships such as "increases", "decreases", "enables", "accelerates", "constrains".',
			].join('\n')
		),
	},
	{
		id: 'evidence',
		name: 'Evidence',
		description: 'Claims, supporting evidence, assumptions, and gaps',
		systemPrompt: buildSystemPrompt(
			[
				'Style: EVIDENCE map. Map the epistemic structure of the topic: the main claims, what supports them, what is assumed, and what is unknown.',
				'Use node types: claim, evidence, assumption, gap.',
				'Edges should capture support, contradiction, dependence on assumptions, and where gaps undermine claims. Be honest about confidence.',
			].join('\n')
		),
	},
	{
		id: 'project',
		name: 'Project',
		description: 'Workstreams, dependencies, deliverables, and milestones',
		systemPrompt: buildSystemPrompt(
			[
				'Style: PROJECT map. Treat the topic as a project to deliver: break it into workstreams, deliverables, dependencies, and milestones.',
				'Use node types: workstream, deliverable, dependency, milestone.',
				'Edges should capture sequencing ("blocks", "feeds into"), ownership, and what each deliverable unlocks.',
			].join('\n')
		),
	},
];

export function getMapStyle(id: string): MapStyle {
	return MAP_STYLES.find((style) => style.id === id) ?? MAP_STYLES[0];
}
