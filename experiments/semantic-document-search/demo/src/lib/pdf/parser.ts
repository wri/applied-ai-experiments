import * as pdfjsLib from 'pdfjs-dist';
// Vite's ?url suffix returns the resolved URL for the worker file
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Page, Chunk } from '../types';
import { chunkText } from '../embeddings/chunker';

// Configure pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// Maximum number of pages to process
export const MAX_PAGES = 150;

export interface ParseProgress {
	phase: 'loading' | 'parsing' | 'extracting';
	current: number;
	total: number;
	message: string;
}

export type ProgressCallback = (progress: ParseProgress) => void;

/**
 * Load a PDF from a URL or ArrayBuffer
 */
export async function loadPDF(
	source: string | ArrayBuffer,
	onProgress?: ProgressCallback
): Promise<pdfjsLib.PDFDocumentProxy> {
	onProgress?.({
		phase: 'loading',
		current: 0,
		total: 100,
		message: 'Loading PDF...'
	});

	const loadingTask = pdfjsLib.getDocument(source);

	loadingTask.onProgress = (data: { loaded: number; total: number }) => {
		const progress = data.total > 0 ? (data.loaded / data.total) * 100 : 0;
		onProgress?.({
			phase: 'loading',
			current: Math.round(progress),
			total: 100,
			message: `Loading PDF... ${Math.round(progress)}%`
		});
	};

	return await loadingTask.promise;
}

/**
 * Extract text content from a single page
 */
async function extractPageText(page: pdfjsLib.PDFPageProxy): Promise<string> {
	const textContent = await page.getTextContent();
	const textItems = textContent.items as Array<{ str: string }>;
	return textItems.map((item) => item.str).join(' ');
}

/**
 * Parse all pages from a PDF document
 */
export async function parsePDF(
	pdf: pdfjsLib.PDFDocumentProxy,
	onProgress?: ProgressCallback
): Promise<Page[]> {
	const pageCount = pdf.numPages;
	const pages: Page[] = [];

	for (let i = 1; i <= pageCount; i++) {
		onProgress?.({
			phase: 'extracting',
			current: i,
			total: pageCount,
			message: `Extracting text from page ${i} of ${pageCount}...`
		});

		const page = await pdf.getPage(i);
		const viewport = page.getViewport({ scale: 1.0 });
		const text = await extractPageText(page);
		const chunks = chunkText(text, i);

		pages.push({
			pageNumber: i,
			width: viewport.width,
			height: viewport.height,
			text,
			chunks
		});
	}

	return pages;
}

/**
 * Load and parse a PDF from URL or ArrayBuffer
 */
export async function loadAndParsePDF(
	source: string | ArrayBuffer,
	onProgress?: ProgressCallback
): Promise<{ pdf: pdfjsLib.PDFDocumentProxy; pages: Page[] }> {
	const pdf = await loadPDF(source, onProgress);

	if (pdf.numPages > MAX_PAGES) {
		throw new Error(
			`Document has ${pdf.numPages} pages, which exceeds the maximum of ${MAX_PAGES} pages. Please use a smaller document.`
		);
	}

	onProgress?.({
		phase: 'parsing',
		current: 0,
		total: pdf.numPages,
		message: `Parsing ${pdf.numPages} pages...`
	});

	const pages = await parsePDF(pdf, onProgress);

	return { pdf, pages };
}

/**
 * Get a PDF page proxy for rendering
 */
export async function getPage(
	pdf: pdfjsLib.PDFDocumentProxy,
	pageNumber: number
): Promise<pdfjsLib.PDFPageProxy> {
	return await pdf.getPage(pageNumber);
}
