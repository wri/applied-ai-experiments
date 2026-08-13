import type {
	BuildMetrics,
	ChunkOptions,
	ChunkResult,
	ChunkStrategyId,
	SearchMetrics,
	SearchResult
} from '../types';
import { DEFAULT_MODEL_ID } from '../embeddings/models';
import { BM25_MODEL_ID } from '../embeddings/bm25';
import { getStrategy } from '../embeddings/chunkers';
import type { DemoConfig } from './config';

export type VariantStatus = 'idle' | 'building' | 'ready' | 'error';

export interface CompareVariant {
	id: string; // local id (A, B, C)
	modelId: string;
	strategyId: ChunkStrategyId;
	chunkOptions: ChunkOptions;
	key: string; // embedding-set key (recomputed at run time)
	status: VariantStatus;
	buildPhase: 'chunking' | 'embedding';
	completed: number;
	total: number;
	buildMetrics?: BuildMetrics;
	results?: SearchResult[];
	rawChunkResults?: ChunkResult[];
	metrics?: SearchMetrics;
	error?: string;
}

export interface ComparisonState {
	query: string;
	variants: CompareVariant[];
	searching: boolean;
}

const VARIANT_IDS = ['A', 'B', 'C', 'D'];

function blankVariant(id: string, modelId: string, strategyId: ChunkStrategyId): CompareVariant {
	return {
		id,
		modelId,
		strategyId,
		chunkOptions: { ...getStrategy(strategyId).defaults },
		key: '',
		status: 'idle',
		buildPhase: 'chunking',
		completed: 0,
		total: 0
	};
}

// Seed a comparison from the active config: variant A mirrors it (semantic),
// variant B is the BM25 keyword baseline on the SAME chunks — a direct
// lexical-vs-semantic contrast. Users can change either or add more configs.
export function createComparison(config: DemoConfig): ComparisonState {
	return {
		query: '',
		searching: false,
		variants: [
			{
				...blankVariant('A', config.modelId, config.strategyId),
				chunkOptions: { ...config.chunkOptions }
			},
			{
				...blankVariant('B', BM25_MODEL_ID, config.strategyId),
				chunkOptions: { ...config.chunkOptions }
			}
		]
	};
}

export function addVariant(state: ComparisonState): ComparisonState {
	if (state.variants.length >= VARIANT_IDS.length) return state;
	const id = VARIANT_IDS[state.variants.length];
	return { ...state, variants: [...state.variants, blankVariant(id, DEFAULT_MODEL_ID, 'fixed')] };
}

export function removeVariant(state: ComparisonState, id: string): ComparisonState {
	if (state.variants.length <= 2) return state;
	return { ...state, variants: state.variants.filter((v) => v.id !== id) };
}

export function updateVariant(
	state: ComparisonState,
	id: string,
	patch: Partial<CompareVariant>
): ComparisonState {
	return {
		...state,
		variants: state.variants.map((v) => (v.id === id ? { ...v, ...patch } : v))
	};
}

export function setComparisonQuery(state: ComparisonState, query: string): ComparisonState {
	return { ...state, query };
}

export function variantLabel(v: CompareVariant, modelLabel: string): string {
	return `${v.id}: ${modelLabel} / ${getStrategy(v.strategyId).label}`;
}
