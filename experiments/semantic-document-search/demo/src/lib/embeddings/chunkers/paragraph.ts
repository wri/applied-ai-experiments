import type { Chunk } from '../../types';
import type { ChunkStrategy } from './types';
import { MIN_CHUNK_LENGTH, cleanText, splitIntoSentences, makeChunkId } from './util';

// Split on blank lines into paragraphs, then break paragraphs longer than the
// max length at sentence boundaries. This is the original chunking behavior.

function splitIntoParagraphs(text: string): string[] {
	return text
		.split(/\n\s*\n/)
		.map((p) => cleanText(p))
		.filter((p) => p.length >= MIN_CHUNK_LENGTH);
}

function splitLongParagraph(paragraph: string, maxLen: number): string[] {
	if (paragraph.length <= maxLen) return [paragraph];

	const sentences = splitIntoSentences(paragraph);
	const chunks: string[] = [];
	let current = '';

	for (const sentence of sentences) {
		if (current.length + sentence.length + 1 <= maxLen) {
			current = current ? `${current} ${sentence}` : sentence;
		} else {
			if (current.length >= MIN_CHUNK_LENGTH) chunks.push(current);
			current = sentence;
		}
	}
	if (current.length >= MIN_CHUNK_LENGTH) chunks.push(current);
	return chunks;
}

export const paragraphStrategy: ChunkStrategy = {
	id: 'paragraph',
	label: 'Paragraph',
	description: 'Split on blank lines; break long paragraphs at sentence boundaries.',
	defaults: { size: 500 },
	paramSpec: [{ key: 'size', label: 'Max chars', min: 200, max: 1000, step: 50 }],
	chunk(text, pageNumber, opts) {
		const maxLen = opts.size ?? 500;
		const chunks: Chunk[] = [];
		let indexInPage = 0;

		for (const paragraph of splitIntoParagraphs(text)) {
			for (const sub of splitLongParagraph(paragraph, maxLen)) {
				chunks.push({
					id: makeChunkId(pageNumber, indexInPage),
					text: sub,
					pageNumber,
					indexInPage
				});
				indexInPage++;
			}
		}
		return chunks;
	}
};
