import type { Chunk } from '../types';
import { chunk } from './chunkers';

// Backward-compatible wrapper: chunk a page of text with the default
// (paragraph) strategy. New code should use `chunk(strategyId, ...)` from
// ./chunkers directly.
export function chunkText(text: string, pageNumber: number): Chunk[] {
	return chunk('paragraph', text, pageNumber);
}
