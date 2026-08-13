/**
 * Theme state — a read-only reactive mirror of the shared design-system theme.
 *
 * The header's shared ThemeSwitcher (@wri-datalab/ui) owns theme switching: it
 * writes `data-theme` onto <body> (where data-variant="prototype" lives) and
 * persists to localStorage['prototype-theme']. This store just observes the
 * attribute so the map basemap and context snapshots can react to changes.
 */

import { browser } from '$app/environment';
import { storageGet, storageRemove } from './storage';

export type Theme = 'dark' | 'light' | 'high-contrast';

export const THEMES: Theme[] = ['dark', 'light', 'high-contrast'];

const SHARED_KEY = 'prototype-theme';

class ThemeStore {
	current = $state<Theme>('dark');

	#observer: MutationObserver | null = null;

	init() {
		if (!browser || this.#observer) return;

		// One-time migration from this demo's old prefixed key (JSON-encoded via
		// the storage helper) to the shared raw key the ThemeSwitcher uses.
		const old = storageGet<Theme | null>('theme', null);
		if (old && THEMES.includes(old) && window.localStorage.getItem(SHARED_KEY) === null) {
			window.localStorage.setItem(SHARED_KEY, old);
		}
		storageRemove('theme');

		const read = () => {
			const t = document.body.dataset.theme as Theme | undefined;
			this.current = t && THEMES.includes(t) ? t : 'dark';
		};
		read();
		this.#observer = new MutationObserver(read);
		this.#observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
	}
}

export const themeStore = new ThemeStore();
