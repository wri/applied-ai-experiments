/**
 * URL state helpers: serialize RESOLVED state (never conversation history)
 * into a compact ?s= query param so views are shareable and reproducible
 * without re-calling the LLM.
 */

import { replaceState } from '$app/navigation';

/** searchParams.get() already percent-decodes; the param value is raw JSON. */
export function decodeState<T>(param: string | null): T | null {
	if (!param) return null;
	try {
		return JSON.parse(param) as T;
	} catch {
		// tolerate links from before/with manual encoding
		try {
			return JSON.parse(decodeURIComponent(param)) as T;
		} catch {
			return null;
		}
	}
}

/** Write state into ?s= without history spam. Returns the shareable URL. */
export function writeStateParam(value: unknown): string {
	const url = new URL(window.location.href);
	const json = JSON.stringify(value);
	if (json.length > 1900) {
		console.warn(`urlState: state is ${json.length} chars (>1900), consider trimming`);
	}
	// searchParams.set percent-encodes exactly once
	url.searchParams.set('s', json);
	replaceState(url, {});
	return url.toString();
}

export function clearStateParam(): void {
	const url = new URL(window.location.href);
	url.searchParams.delete('s');
	replaceState(url, {});
}
