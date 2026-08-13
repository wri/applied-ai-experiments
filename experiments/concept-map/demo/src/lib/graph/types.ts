/**
 * Graph data shapes shared by the prompts, the state machine, and the
 * renderer. The LLM only ever produces GraphData; positions are added by
 * the deterministic d3-force layout.
 */

export interface ConceptNode {
	/** snake_case identifier, unique within the graph */
	id: string;
	/** Display label, at most 4 words */
	label: string;
	/** Node type from the active map style's vocabulary */
	type: string;
	/** 1-2 sentence explanation shown in the detail panel */
	description: string;
	follow_up_questions?: string[];
}

export interface ConceptEdge {
	source: string;
	target: string;
	/** Short relationship label, at most 3 words */
	relationship: string;
	/** One sentence on why this edge exists */
	explanation: string;
}

export interface GraphData {
	nodes: ConceptNode[];
	edges: ConceptEdge[];
}

/** A node after layout — what the renderer consumes. */
export interface PositionedNode extends ConceptNode {
	x: number;
	y: number;
}

/** JSON Schema every generate/expand response must conform to. */
export const GRAPH_SCHEMA: Record<string, unknown> = {
	type: 'object',
	required: ['nodes', 'edges'],
	properties: {
		nodes: {
			type: 'array',
			items: {
				type: 'object',
				required: ['id', 'label', 'type', 'description'],
				properties: {
					id: {
						type: 'string',
						description: 'snake_case identifier, unique within the graph',
					},
					label: {
						type: 'string',
						description: 'Short display label, at most 4 words',
					},
					type: {
						type: 'string',
						description: 'Node type from the requested vocabulary',
					},
					description: {
						type: 'string',
						description: '1-2 sentence explanation of this node',
					},
					follow_up_questions: {
						type: 'array',
						items: { type: 'string' },
						description: 'Optional questions a curious reader might ask next',
					},
				},
			},
		},
		edges: {
			type: 'array',
			items: {
				type: 'object',
				required: ['source', 'target', 'relationship', 'explanation'],
				properties: {
					source: { type: 'string', description: 'id of an existing node' },
					target: { type: 'string', description: 'id of an existing node' },
					relationship: {
						type: 'string',
						description: 'Short edge label, at most 3 words',
					},
					explanation: {
						type: 'string',
						description: 'One sentence on why this relationship holds',
					},
				},
			},
		},
	},
};
