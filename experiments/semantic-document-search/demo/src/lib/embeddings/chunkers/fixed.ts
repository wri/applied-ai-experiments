import type { Chunk } from '../../types';
import type { ChunkStrategy } from './types';
import { cleanText, makeChunkId } from './util';

// Sliding fixed-size character window with overlap. Predictable baseline that
// ignores document structure.

export const fixedStrategy: ChunkStrategy = {
	id: 'fixed',
	label: 'Fixed-size',
	description: 'Sliding window of N characters with overlap. Predictable, structure-agnostic.',
	defaults: { size: 400, overlap: 50 },
	paramSpec: [
		{ key: 'size', label: 'Chunk size', min: 100, max: 1000, step: 50, unitLabel: 'chars' },
		{ key: 'overlap', label: 'Overlap', min: 0, max: 300, step: 25, unitLabel: 'chars' }
	],
	chunk(text, pageNumber, opts) {
		const size = Math.max(50, opts.size ?? 400);
		const overlap = Math.min(Math.max(0, opts.overlap ?? 50), size - 1);
		const step = Math.max(1, size - overlap);

		const clean = cleanText(text);
		const chunks: Chunk[] = [];
		let indexInPage = 0;

		for (let start = 0; start < clean.length; start += step) {
			const slice = clean.slice(start, start + size).trim();
			if (slice.length >= 20) {
				chunks.push({
					id: makeChunkId(pageNumber, indexInPage),
					text: slice,
					pageNumber,
					indexInPage
				});
				indexInPage++;
			}
			if (start + size >= clean.length) break;
		}
		return chunks;
	}
};
