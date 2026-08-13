import type { BYOKStores } from '@byo-keys/svelte';
import type { ProviderId, ModelInfo, TokenUsage } from '@byo-keys/core';
import {
	runLLM,
	parseStructured,
	buildRepairPrompt,
	computeCost,
	type MockSpec,
	sumUsage,
	createRunHistory,
	type InspectableRequest,
	type RunRecord,
} from '@wri-datalab/llm-lab';
import { toast } from '@wri-datalab/ui';
import {
	GRAPH_SCHEMA,
	type ConceptEdge,
	type GraphData,
	type PositionedNode,
} from '../graph/types';
import { layoutGraph } from '../graph/layout';
import { getMapStyle } from '../prompts/map-styles';
import { buildExpandPrompt } from '../prompts/expand';
import { generateMock, expandMock, repairMock } from '../mocks';

export type MapPhase = 'idle' | 'generating' | 'expanding' | 'done' | 'error';

export const DEFAULT_TOPIC = 'Climate finance for urban adaptation';

interface GraphCallOutcome {
	graph: GraphData | null;
	error?: string;
	raw: string;
	requests: InspectableRequest[];
	usage?: TokenUsage;
	latencyMs: number;
}

function edgeKey(edge: ConceptEdge): string {
	return `${edge.source}|${edge.target}|${edge.relationship}`;
}

export function createMapState(stores: BYOKStores) {
	let topic = $state(DEFAULT_TOPIC);
	let styleId = $state('explainer');
	let phase = $state<MapPhase>('idle');
	let nodes = $state<PositionedNode[]>([]);
	let edges = $state<ConceptEdge[]>([]);
	let selectedNodeId = $state<string | null>(null);
	let error = $state<string | null>(null);
	let lastRequest = $state<InspectableRequest | null>(null);
	let lastRaw = $state('');
	let totalUsage = $state<TokenUsage>({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
	let totalCostUsd = $state(0);
	/** True when the last call came from a keyless fixture rather than the network. */
	let mocked = $state(false);

	const history = createRunHistory('concept-map');

	const busy = $derived(phase === 'generating' || phase === 'expanding');
	const selectedNode = $derived(nodes.find((node) => node.id === selectedNodeId) ?? null);

	function modelInfo(providerId: ProviderId, modelId: string): ModelInfo | undefined {
		return stores
			.getClient()
			.getModels(providerId)
			.find((m) => m.id === modelId);
	}

	function accumulate(model: ModelInfo | undefined, usage?: TokenUsage) {
		if (!usage) return;
		totalUsage = sumUsage([totalUsage, usage]);
		const cost = computeCost(model, usage);
		if (cost !== null) totalCostUsd += cost;
	}

	/** One structured-output call with at most one repair pass. */
	async function callForGraph(
		providerId: ProviderId,
		modelId: string,
		system: string,
		userPrompt: string,
		label: string,
		mock: MockSpec
	): Promise<GraphCallOutcome> {
		const model = modelInfo(providerId, modelId);
		const requests: InspectableRequest[] = [];
		let latencyMs = 0;

		let result = await runLLM(stores, {
			providerId,
			model: modelId,
			system,
			messages: [{ role: 'user', content: userPrompt }],
			temperature: 0.4,
			maxTokens: 4000,
			schema: GRAPH_SCHEMA,
			label,
			mock,
		});
		mocked = result.mocked === true;
		requests.push(result.request);
		lastRequest = result.request;
		lastRaw = result.content;
		latencyMs += result.latencyMs;
		accumulate(model, result.usage);

		let parsed = parseStructured(result.content, GRAPH_SCHEMA);
		if (!parsed.ok && !result.error) {
			result = await runLLM(stores, {
				providerId,
				model: modelId,
				system,
				messages: [
					{ role: 'user', content: userPrompt },
					{ role: 'assistant', content: result.content },
					{
						role: 'user',
						content: buildRepairPrompt({
							schema: GRAPH_SCHEMA,
							rawOutput: result.content,
							issues: parsed.issues,
						}),
					},
				],
				temperature: 0.4,
				maxTokens: 4000,
				schema: GRAPH_SCHEMA,
				label: `${label} repair`,
				mock: repairMock,
			});
			requests.push(result.request);
			lastRequest = result.request;
			lastRaw = result.content;
			latencyMs += result.latencyMs;
			accumulate(model, result.usage);
			parsed = parseStructured(result.content, GRAPH_SCHEMA);
		}

		const base = { raw: result.content, requests, usage: result.usage, latencyMs };
		if (result.error) {
			return { graph: null, error: result.error, ...base };
		}
		if (!parsed.ok) {
			const issues = parsed.issues.map((issue) => issue.message).join('; ');
			return { graph: null, error: `Output failed schema validation: ${issues}`, ...base };
		}
		return { graph: parsed.value as GraphData, ...base };
	}

	/** Drop edges whose endpoints don't exist; warn about how many were dropped. */
	function enforceIntegrity(graph: GraphData): GraphData {
		const ids = new Set(graph.nodes.map((node) => node.id));
		const kept = graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
		const dropped = graph.edges.length - kept.length;
		if (dropped > 0) {
			toast.error(
				`Dropped ${dropped} edge${dropped === 1 ? '' : 's'} referencing node ids that don't exist`
			);
		}
		return { nodes: graph.nodes, edges: kept };
	}

	async function saveRun(label: string, outcome: GraphCallOutcome) {
		await history.save({
			label,
			config: { topic, styleId },
			requests: outcome.requests,
			responses: [
				{
					content: outcome.raw,
					parsed: { nodes: $state.snapshot(nodes), edges: $state.snapshot(edges) },
					usage: outcome.usage,
					latencyMs: outcome.latencyMs,
				},
			],
		});
	}

	async function generate(providerId: ProviderId, modelId: string) {
		if (busy || !topic.trim() || !modelId) return;
		phase = 'generating';
		error = null;
		selectedNodeId = null;

		const style = getMapStyle(styleId);
		const outcome = await callForGraph(
			providerId,
			modelId,
			style.systemPrompt,
			`Build a ${style.name.toLowerCase()} concept map for this topic:\n\n${topic.trim()}`,
			'generate',
			generateMock
		);

		if (!outcome.graph) {
			phase = 'error';
			error = outcome.error ?? 'Unknown error';
			toast.error('Map generation failed');
			return;
		}

		const clean = enforceIntegrity(outcome.graph);
		nodes = layoutGraph(clean.nodes, clean.edges);
		edges = clean.edges;
		phase = 'done';

		await saveRun(`${style.name}: ${topic.trim().slice(0, 60)}`, outcome);
	}

	async function expand(providerId: ProviderId, modelId: string, nodeId: string) {
		const focal = nodes.find((node) => node.id === nodeId);
		if (busy || !focal || !modelId) return;
		phase = 'expanding';
		error = null;

		const style = getMapStyle(styleId);
		const outcome = await callForGraph(
			providerId,
			modelId,
			style.systemPrompt,
			buildExpandPrompt(topic.trim(), nodes, focal),
			`expand:${nodeId}`,
			expandMock
		);

		if (!outcome.graph) {
			phase = 'error';
			error = outcome.error ?? 'Unknown error';
			toast.error('Node expansion failed');
			return;
		}

		// Dedupe nodes by id — on collision the existing node record wins.
		const existingIds = new Set(nodes.map((node) => node.id));
		const newNodes = outcome.graph.nodes.filter((node) => !existingIds.has(node.id));
		const mergedNodes = [...$state.snapshot(nodes), ...newNodes];

		// Integrity check against the merged node set, then dedupe edges.
		const clean = enforceIntegrity({ nodes: mergedNodes, edges: outcome.graph.edges });
		const seenEdges = new Set(edges.map(edgeKey));
		const newEdges = clean.edges.filter((edge) => !seenEdges.has(edgeKey(edge)));
		const mergedEdges = [...$state.snapshot(edges), ...newEdges];

		// Re-layout gently: existing nodes keep their positions as the starting
		// state, new nodes seed around the focal node, low alpha preserves shape.
		const previous = new Map(nodes.map((node) => [node.id, { x: node.x, y: node.y }]));
		nodes = layoutGraph(mergedNodes, mergedEdges, {
			previous,
			seed: { x: focal.x, y: focal.y },
			alpha: 0.3,
		});
		edges = mergedEdges;
		phase = 'done';

		if (newNodes.length === 0) {
			toast.error('Expansion produced no new nodes (all ids already existed)');
		}

		await saveRun(`Expand ${focal.label}`, outcome);
	}

	function select(nodeId: string | null) {
		selectedNodeId = nodeId;
	}

	function restore(record: RunRecord) {
		const config = record.config as { topic?: string; styleId?: string };
		if (typeof config.topic === 'string') topic = config.topic;
		if (typeof config.styleId === 'string') styleId = config.styleId;

		const parsed = record.responses[0]?.parsed as
			| { nodes?: PositionedNode[]; edges?: ConceptEdge[] }
			| undefined;
		if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
			const positioned = parsed.nodes.every(
				(node) => typeof node.x === 'number' && typeof node.y === 'number'
			);
			nodes = positioned ? parsed.nodes : layoutGraph(parsed.nodes, parsed.edges);
			edges = parsed.edges;
			selectedNodeId = null;
			error = null;
			phase = 'done';
		}
	}

	return {
		history,
		get topic() { return topic; },
		set topic(v: string) { topic = v; },
		get styleId() { return styleId; },
		set styleId(v: string) { styleId = v; },
		get phase() { return phase; },
		get nodes() { return nodes; },
		get edges() { return edges; },
		get selectedNodeId() { return selectedNodeId; },
		get selectedNode() { return selectedNode; },
		get busy() { return busy; },
		get error() { return error; },
		get lastRequest() { return lastRequest; },
		get lastRaw() { return lastRaw; },
		get totalUsage() { return totalUsage; },
		get totalCostUsd() { return totalCostUsd; },
		get mocked() { return mocked; },
		generate,
		expand,
		select,
		restore,
	};
}

export type MapState = ReturnType<typeof createMapState>;
