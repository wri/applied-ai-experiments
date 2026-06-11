import type { Chunk } from '../../types';
import type { ChunkStrategy } from './types';
import { cleanText, makeChunkId } from './util';

// One chunk per page. The coarsest option — long pages are truncated to the
// model's max sequence length by the tokenizer. Useful as a contrast baseline
// for page-level scoring.

export const pageStrategy: ChunkStrategy = {
	id: 'page',
	label: 'Whole page',
	description: 'One chunk per page. Coarse; long pages are truncated by the model.',
	defaults: {},
	paramSpec: [],
	chunk(text, pageNumber) {
		const clean = cleanText(text);
		if (clean.length < 20) return [];
		return [
			{
				id: makeChunkId(pageNumber, 0),
				text: clean,
				pageNumber,
				indexInPage: 0
			}
		];
	}
};
