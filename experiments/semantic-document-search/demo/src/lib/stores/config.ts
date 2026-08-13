import type { ChunkOptions, ChunkStrategyId, Device } from '../types';
import { DEFAULT_MODEL_ID } from '../embeddings/models';
import { DEFAULT_STRATEGY_ID, getStrategy } from '../embeddings/chunkers';

// The active embedding configuration. Changing the model or chunking re-embeds
// the document, so this is held separately and survives re-embeds.
export interface DemoConfig {
	modelId: string;
	strategyId: ChunkStrategyId;
	chunkOptions: ChunkOptions;
	backend: Device | 'unknown'; // reported by the worker after model load
}

export function createInitialConfig(): DemoConfig {
	return {
		modelId: DEFAULT_MODEL_ID,
		strategyId: DEFAULT_STRATEGY_ID,
		chunkOptions: { ...getStrategy(DEFAULT_STRATEGY_ID).defaults },
		backend: 'unknown'
	};
}

export function setConfigModel(config: DemoConfig, modelId: string): DemoConfig {
	return { ...config, modelId };
}

// Switching strategy resets options to that strategy's defaults.
export function setConfigStrategy(config: DemoConfig, strategyId: ChunkStrategyId): DemoConfig {
	return { ...config, strategyId, chunkOptions: { ...getStrategy(strategyId).defaults } };
}

export function setConfigOptions(config: DemoConfig, options: ChunkOptions): DemoConfig {
	return { ...config, chunkOptions: { ...config.chunkOptions, ...options } };
}

export function setConfigBackend(config: DemoConfig, backend: Device | 'unknown'): DemoConfig {
	return { ...config, backend };
}
