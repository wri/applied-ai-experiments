/**
 * Overture Maps access: release resolution, PMTiles URLs, GeoParquet part listing.
 *
 * All Overture-hosted assets are keyed by release id, and releases are deleted
 * ~60 days after publication — a pinned URL rots. So the current release is
 * resolved from the STAC catalog at app load (cached in localStorage for 24h)
 * with PINNED_RELEASE as the offline/failure fallback.
 *
 * Browser-safe AND node-safe (no SvelteKit imports, localStorage guarded):
 * scripts/extract-overture.ts imports this module too.
 */

export const PINNED_RELEASE = '2026-06-17.0'; // bump whenever this file is touched

export const OVERTURE_ATTRIBUTION = '© OpenStreetMap contributors, Overture Maps Foundation';

const TILES_BASE = 'https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles';
const DATA_BASE = 'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com';
const STAC_CATALOG = 'https://stac.overturemaps.org/catalog.json';

const CACHE_KEY = 'ai-web-map-exploration:overture:release:v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type OvertureTheme = 'base' | 'buildings' | 'places' | 'transportation' | 'divisions';

export function pmtilesUrl(release: string, theme: OvertureTheme): string {
	return `pmtiles://${TILES_BASE}/${release}/${theme}.pmtiles`;
}

interface CachedRelease {
	release: string;
	fetchedAt: number;
}

function readCache(): string | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		if (!raw) return null;
		const cached = JSON.parse(raw) as CachedRelease;
		if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) return null;
		return cached.release;
	} catch {
		return null;
	}
}

function writeCache(release: string): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify({ release, fetchedAt: Date.now() }));
	} catch {
		/* quota/private mode — fine, we just re-resolve next load */
	}
}

/**
 * Resolve the current Overture release id from the STAC catalog.
 * Never throws: any failure (offline, timeout, shape change) falls back to
 * PINNED_RELEASE with a console warning.
 */
export async function resolveRelease(): Promise<string> {
	const cached = readCache();
	if (cached) return cached;

	try {
		const res = await fetch(STAC_CATALOG, { signal: AbortSignal.timeout(3000) });
		if (!res.ok) throw new Error(`STAC catalog: HTTP ${res.status}`);
		const catalog = (await res.json()) as { links?: { href?: string }[] };
		const ids = (catalog.links ?? [])
			.map((l) => l.href?.match(/(\d{4}-\d{2}-\d{2}\.\d+)/)?.[1])
			.filter((id): id is string => !!id)
			.sort();
		const latest = ids.at(-1);
		if (!latest) throw new Error('no release ids in STAC catalog');
		writeCache(latest);
		return latest;
	} catch (e) {
		console.warn(
			`[overture] release resolution failed (${(e as Error).message}) — using pinned ${PINNED_RELEASE}`
		);
		return PINNED_RELEASE;
	}
}

/**
 * Enumerate GeoParquet part-file URLs for a theme/type via anonymous S3
 * ListObjectsV2 (DuckDB-WASM can't glob s3:// reliably, and node avoids an SDK).
 */
export async function listParquetParts(
	release: string,
	theme: string,
	type: string
): Promise<string[]> {
	const prefix = `release/${release}/theme=${theme}/type=${type}/`;
	const keys: string[] = [];
	let token: string | undefined;
	do {
		const params = new URLSearchParams({ 'list-type': '2', prefix });
		if (token) params.set('continuation-token', token);
		const res = await fetch(`${DATA_BASE}/?${params}`, { signal: AbortSignal.timeout(10000) });
		if (!res.ok) throw new Error(`S3 listing failed: HTTP ${res.status}`);
		const xml = await res.text();
		for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) {
			if (m[1].endsWith('.parquet')) keys.push(m[1]);
		}
		token = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1];
	} while (token);
	return keys.map((k) => `${DATA_BASE}/${k}`);
}
