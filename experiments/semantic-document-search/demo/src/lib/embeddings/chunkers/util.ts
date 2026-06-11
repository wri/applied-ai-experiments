// Shared helpers for chunking strategies.

export const MIN_CHUNK_LENGTH = 50;

// Normalize whitespace and strip non-printable characters. Note this collapses
// newlines into spaces, so paragraph-aware strategies must split on blank lines
// BEFORE calling this.
export function cleanText(text: string): string {
	return text
		.replace(/\s+/g, ' ')
		.replace(/[^\x20-\x7E\n]/g, '')
		.trim();
}

// Simple sentence splitter on terminal punctuation.
export function splitIntoSentences(text: string): string[] {
	return text
		.split(/(?<=[.!?])\s+/)
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

// Chunk ids are unique within a single embedding set (one model + strategy),
// which is all the worker-side cache requires.
export function makeChunkId(pageNumber: number, indexInPage: number): string {
	return `p${pageNumber}-c${indexInPage}`;
}
