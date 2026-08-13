import type { ConceptNode } from '../graph/types';

/**
 * User prompt for growing the graph around one node. The system prompt
 * (and therefore the schema and style vocabulary) is the same one used
 * for the initial map.
 */
export function buildExpandPrompt(
	topic: string,
	nodes: ConceptNode[],
	focal: ConceptNode
): string {
	const existing = nodes.map((node) => `${node.id}: ${node.label}`).join('\n');
	return [
		`Topic: ${topic}`,
		'',
		'Current graph nodes (id: label):',
		existing,
		'',
		'Focal node to expand (full record):',
		JSON.stringify(focal, null, 2),
		'',
		'Add 3-6 NEW nodes that deepen the map around the focal node, plus the edges that connect them.',
		'Edges may connect new nodes to each other, to the focal node, or to any existing node id.',
		'Reuse existing ids when referring to existing concepts; new ids must not collide with existing ids.',
		'Return ONLY the new nodes and the new edges in the same JSON schema — do not repeat existing nodes.',
	].join('\n');
}
