import type * as pdfjsLib from 'pdfjs-dist';

const THUMBNAIL_SCALE = 0.3;
const FULL_PAGE_SCALE = 1.5;

/**
 * Render a PDF page to a canvas and return as data URL
 */
async function renderToCanvas(
	page: pdfjsLib.PDFPageProxy,
	scale: number
): Promise<string> {
	const viewport = page.getViewport({ scale });

	const canvas = document.createElement('canvas');
	canvas.width = viewport.width;
	canvas.height = viewport.height;

	const context = canvas.getContext('2d');
	if (!context) {
		throw new Error('Could not get canvas context');
	}

	await page.render({
		canvasContext: context,
		viewport
	}).promise;

	return canvas.toDataURL('image/png');
}

/**
 * Generate a thumbnail for a PDF page
 */
export async function generateThumbnail(
	page: pdfjsLib.PDFPageProxy
): Promise<string> {
	return renderToCanvas(page, THUMBNAIL_SCALE);
}

/**
 * Render a full-resolution page image
 */
export async function renderFullPage(
	page: pdfjsLib.PDFPageProxy
): Promise<string> {
	return renderToCanvas(page, FULL_PAGE_SCALE);
}

/**
 * Generate thumbnails for multiple pages with progress callback
 */
export async function generateThumbnails(
	pdf: pdfjsLib.PDFDocumentProxy,
	onProgress?: (current: number, total: number) => void
): Promise<Map<number, string>> {
	const thumbnails = new Map<number, string>();
	const pageCount = pdf.numPages;

	for (let i = 1; i <= pageCount; i++) {
		const page = await pdf.getPage(i);
		const thumbnail = await generateThumbnail(page);
		thumbnails.set(i, thumbnail);
		onProgress?.(i, pageCount);
	}

	return thumbnails;
}
