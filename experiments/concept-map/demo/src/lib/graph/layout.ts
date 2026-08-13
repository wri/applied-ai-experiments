import {
	forceSimulation,
	forceManyBody,
	forceLink,
	forceCenter,
	forceCollide,
	type SimulationNodeDatum,
	type SimulationLinkDatum,
} from 'd3-force';
import type { ConceptNode, ConceptEdge, PositionedNode } from './types';

interface SimNode extends ConceptNode, SimulationNodeDatum {}
type SimLink = SimulationLinkDatum<SimNode>;

export interface LayoutOptions {
	/** Logical canvas size the layout centers within */
	width?: number;
	height?: number;
	/** Known positions (by node id) to use as the starting state */
	previous?: Map<string, { x: number; y: number }>;
	/** Where to seed nodes that have no previous position (e.g. the expanded node's spot) */
	seed?: { x: number; y: number };
	/** Lower alpha keeps an existing layout mostly in place (default 1 = full settle) */
	alpha?: number;
}

const TICKS = 200;

/**
 * Deterministic-enough synchronous force layout: build the simulation,
 * stop it, tick it a fixed number of times, return positioned copies.
 * The renderer never animates the simulation — it just draws the result.
 */
export function layoutGraph(
	nodes: ConceptNode[],
	edges: ConceptEdge[],
	options: LayoutOptions = {}
): PositionedNode[] {
	const { width = 1200, height = 800, previous, seed, alpha = 1 } = options;

	let newIndex = 0;
	const simNodes: SimNode[] = nodes.map((node) => {
		const prev = previous?.get(node.id);
		if (prev) {
			return { ...node, x: prev.x, y: prev.y };
		}
		if (seed) {
			// Index-based offsets around the seed so new nodes start spread out
			// instead of stacked, without true randomness.
			const angle = (newIndex * 2 * Math.PI) / 6 + 0.5;
			const radius = 70 + (newIndex % 3) * 25;
			newIndex += 1;
			return {
				...node,
				x: seed.x + Math.cos(angle) * radius,
				y: seed.y + Math.sin(angle) * radius,
			};
		}
		return { ...node };
	});

	const simLinks: SimLink[] = edges.map((edge) => ({
		source: edge.source,
		target: edge.target,
	}));

	const simulation = forceSimulation(simNodes)
		.force('charge', forceManyBody().strength(-400))
		.force(
			'link',
			forceLink<SimNode, SimLink>(simLinks)
				.id((node) => node.id)
				.distance(120)
		)
		.force('center', forceCenter(width / 2, height / 2))
		.force('collide', forceCollide(50))
		.alpha(alpha)
		.stop();

	for (let i = 0; i < TICKS; i += 1) {
		simulation.tick();
	}

	return simNodes.map((sim) => {
		const positioned: PositionedNode = {
			id: sim.id,
			label: sim.label,
			type: sim.type,
			description: sim.description,
			x: sim.x ?? 0,
			y: sim.y ?? 0,
		};
		if (sim.follow_up_questions) {
			positioned.follow_up_questions = sim.follow_up_questions;
		}
		return positioned;
	});
}
