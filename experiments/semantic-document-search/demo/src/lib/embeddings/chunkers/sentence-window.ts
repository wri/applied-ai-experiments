import type { Chunk } from '../../types';
import type { ChunkStrategy } from './types';
import { cleanText, splitIntoSentences, makeChunkId } from './util';

// Group N consecutive sentences per chunk with a sentence of overlap. Tends to
// produce focused, retrieval-friendly chunks.

export const sentenceWindowStrategy: ChunkStrategy = {
	id: 'sentence-window',
	label: 'Sentence window',
	description: 'Group N sentences per chunk with sentence overlap. Focused, precise units.',
	defaults: { size: 3, overlap: 1 },
	paramSpec: [
		{ key: 'size', label: 'Sentences', min: 1, max: 8, step: 1, unitLabel: 'sentences' },
		{ key: 'overlap', label: 'Overlap', min: 0, max: 4, step: 1, unitLabel: 'sentences' }
	],
	chunk(text, pageNumber, opts) {
		const size = Math.max(1, opts.size ?? 3);
		const overlap = Math.min(Math.max(0, opts.overlap ?? 1), size - 1);
		const step = Math.max(1, size - overlap);

		const sentences = splitIntoSentences(cleanText(text));
		const chunks: Chunk[] = [];
		let indexInPage = 0;

		for (let start = 0; start < sentences.length; start += step) {
			const windowText = sentences.slice(start, start + size).join(' ').trim();
			if (windowText.length >= 20) {
				chunks.push({
					id: makeChunkId(pageNumber, indexInPage),
					text: windowText,
					pageNumber,
					indexInPage
				});
				indexInPage++;
			}
			if (start + size >= sentences.length) break;
		}
		return chunks;
	}
};
