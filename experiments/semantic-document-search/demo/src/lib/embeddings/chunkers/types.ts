import type { Chunk, ChunkOptions, ChunkStrategyId } from '../../types';

// One tunable parameter of a chunking strategy, used to render the sliders in
// the chunking picker.
export interface ParamSpec {
	key: 'size' | 'overlap';
	label: string;
	min: number;
	max: number;
	step: number;
	unitLabel?: string;
}

export interface ChunkStrategy {
	id: ChunkStrategyId;
	label: string;
	description: string;
	defaults: ChunkOptions;
	paramSpec: ParamSpec[];
	chunk(text: string, pageNumber: number, opts: ChunkOptions): Chunk[];
}
