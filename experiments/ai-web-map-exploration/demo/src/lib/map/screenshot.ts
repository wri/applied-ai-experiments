import type maplibregl from 'maplibre-gl';

export interface Screenshot {
	/** raw base64 (no data: prefix) for API payloads */
	base64: string;
	dataUrl: string;
	width: number;
	height: number;
}

/**
 * Capture the current viewport from the map canvas, downscaled for vision
 * models. Requires the map to be created with preserveDrawingBuffer: true.
 */
export function captureViewport(map: maplibregl.Map, maxEdge = 1024): Screenshot | null {
	try {
		const canvas = map.getCanvas();
		const scale = Math.min(1, maxEdge / Math.max(canvas.width, canvas.height));
		const w = Math.round(canvas.width * scale);
		const h = Math.round(canvas.height * scale);
		const target = document.createElement('canvas');
		target.width = w;
		target.height = h;
		const ctx = target.getContext('2d');
		if (!ctx) return null;
		ctx.drawImage(canvas, 0, 0, w, h);
		const dataUrl = target.toDataURL('image/jpeg', 0.8);
		return {
			base64: dataUrl.split(',')[1],
			dataUrl,
			width: w,
			height: h
		};
	} catch {
		// SecurityError from tainted canvas, or context loss — degrade gracefully
		return null;
	}
}
