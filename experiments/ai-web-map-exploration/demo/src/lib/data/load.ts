/**
 * Static dataset loading. Everything goes through ${base} (adapter-static
 * subpath deploys) and is cached per session.
 */

import { base } from '$app/paths';

const cache = new Map<string, Promise<unknown>>();

export function loadData<T = GeoJSON.FeatureCollection>(name: string): Promise<T> {
	if (!cache.has(name)) {
		cache.set(
			name,
			fetch(`${base}/data/${name}`).then((res) => {
				if (!res.ok) throw new Error(`Failed to load ${name}: ${res.status}`);
				return res.json();
			})
		);
	}
	return cache.get(name) as Promise<T>;
}

export function loadText(path: string): Promise<string> {
	const key = `text:${path}`;
	if (!cache.has(key)) {
		cache.set(
			key,
			fetch(`${base}/data/${path}`).then((res) => {
				if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
				return res.text();
			})
		);
	}
	return cache.get(key) as Promise<string>;
}
