import type { Chunk } from '../types';

const MIN_CHUNK_LENGTH = 50;
const MAX_CHUNK_LENGTH = 500;

/**
 * Split text into sentences (simple heuristic)
 */
function splitIntoSentences(text: string): string[] {
	// Split on common sentence endings
	return text
		.split(/(?<=[.!?])\s+/)
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

/**
 * Split a long paragraph into smaller chunks by sentences
 */
function splitLongParagraph(paragraph: string): string[] {
	if (paragraph.length <= MAX_CHUNK_LENGTH) {
		return [paragraph];
	}

	const sentences = splitIntoSentences(paragraph);
	const chunks: string[] = [];
	let currentChunk = '';

	for (const sentence of sentences) {
		if (currentChunk.length + sentence.length + 1 <= MAX_CHUNK_LENGTH) {
			currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
		} else {
			if (currentChunk.length >= MIN_CHUNK_LENGTH) {
				chunks.push(currentChunk);
			}
			currentChunk = sentence;
		}
	}

	if (currentChunk.length >= MIN_CHUNK_LENGTH) {
		chunks.push(currentChunk);
	}

	return chunks;
}

/**
 * Clean and normalize text
 */
function cleanText(text: string): string {
	return text
		.replace(/\s+/g, ' ') // Normalize whitespace
		.replace(/[^\x20-\x7E\n]/g, '') // Remove non-printable chars
		.trim();
}

/**
 * Split text into paragraphs on double newlines
 */
function splitIntoParagraphs(text: string): string[] {
	return text
		.split(/\n\s*\n/)
		.map((p) => cleanText(p))
		.filter((p) => p.length >= MIN_CHUNK_LENGTH);
}

/**
 * Generate a unique chunk ID
 */
function generateChunkId(pageNumber: number, indexInPage: number): string {
	return `p${pageNumber}-c${indexInPage}`;
}

/**
 * Convert text to chunks with metadata
 */
export function chunkText(text: string, pageNumber: number): Chunk[] {
	const paragraphs = splitIntoParagraphs(text);
	const chunks: Chunk[] = [];
	let indexInPage = 0;

	for (const paragraph of paragraphs) {
		const subChunks = splitLongParagraph(paragraph);

		for (const subChunk of subChunks) {
			chunks.push({
				id: generateChunkId(pageNumber, indexInPage),
				text: subChunk,
				pageNumber,
				indexInPage
			});
			indexInPage++;
		}
	}

	return chunks;
}

/**
 * Get all chunks from multiple pages
 */
export function getAllChunks(pages: Array<{ chunks: Chunk[] }>): Chunk[] {
	return pages.flatMap((page) => page.chunks);
}
