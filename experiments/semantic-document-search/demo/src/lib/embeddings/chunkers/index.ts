import type { Chunk, ChunkOptions, ChunkStrategyId } from '../../types';
import type { ChunkStrategy } from './types';
import { paragraphStrategy } from './paragraph';
import { fixedStrategy } from './fixed';
import { sentenceWindowStrategy } from './sentence-window';
import { pageStrategy } from './page';

export const CHUNK_STRATEGIES: Record<ChunkStrategyId, ChunkStrategy> = {
	paragraph: paragraphStrategy,
	fixed: fixedStrategy,
	'sentence-window': sentenceWindowStrategy,
	page: pageStrategy
};

export const CHUNK_STRATEGY_LIST: ChunkStrategy[] = [
	paragraphStrategy,
	sentenceWindowStrategy,
	fixedStrategy,
	pageStrategy
];

export const DEFAULT_STRATEGY_ID: ChunkStrategyId = 'paragraph';

export function getStrategy(id: ChunkStrategyId): ChunkStrategy {
	return CHUNK_STRATEGIES[id] ?? paragraphStrategy;
}

// Dispatch to a named strategy, merging caller options over the strategy's
// defaults.
export function chunk(
	strategyId: ChunkStrategyId,
	text: string,
	pageNumber: number,
	opts: ChunkOptions = {}
): Chunk[] {
	const strategy = getStrategy(strategyId);
	return strategy.chunk(text, pageNumber, { ...strategy.defaults, ...opts });
}

export type { ChunkStrategy, ParamSpec } from './types';
