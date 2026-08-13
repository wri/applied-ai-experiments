/**
 * localStorage wrapper with the app-slug prefix (monorepo BYOK convention:
 * keys are namespaced by demo slug so multiple demos coexist on one origin).
 */

import { browser } from '$app/environment';

const PREFIX = 'ai-web-map-exploration:';

export function storageGet<T>(key: string, fallback: T): T {
	if (!browser) return fallback;
	try {
		const raw = window.localStorage.getItem(PREFIX + key);
		if (raw === null) return fallback;
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

export function storageSet(key: string, value: unknown): void {
	if (!browser) return;
	try {
		window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
	} catch {
		// quota / private mode — non-fatal
	}
}

export function storageRemove(key: string): void {
	if (!browser) return;
	try {
		window.localStorage.removeItem(PREFIX + key);
	} catch {
		// ignore
	}
}
