/**
 * Nominatim geocoding with an in-module cache, plus hardcoded fallbacks for
 * the place names the demos depend on (Nominatim allows ~1 req/s and demos
 * must not hinge on its uptime).
 */

export interface GeocodeResult {
	name: string;
	center: [number, number];
	zoom: number;
}

const FALLBACKS: Record<string, GeocodeResult> = {
	'can tho': { name: 'Cần Thơ, Vietnam', center: [105.746, 10.045], zoom: 12 },
	'cần thơ': { name: 'Cần Thơ, Vietnam', center: [105.746, 10.045], zoom: 12 },
	'mekong delta': { name: 'Mekong Delta, Vietnam', center: [105.7, 9.95], zoom: 8 },
	'lower zambezi': { name: 'Lower Zambezi, Mozambique', center: [35.35, -17.9], zoom: 8 },
	zambezi: { name: 'Zambezi River', center: [35.35, -17.9], zoom: 7 },
	hanoi: { name: 'Hà Nội, Vietnam', center: [105.834, 21.028], zoom: 11 },
	nairobi: { name: 'Nairobi, Kenya', center: [36.817, -1.286], zoom: 11 }
};

const cache = new Map<string, GeocodeResult | null>();
let lastRequestAt = 0;

export async function geocode(query: string): Promise<GeocodeResult | null> {
	const key = query.trim().toLowerCase();
	if (!key) return null;
	if (FALLBACKS[key]) return FALLBACKS[key];
	if (cache.has(key)) return cache.get(key) ?? null;

	// Politeness: min 1s between requests
	const wait = Math.max(0, lastRequestAt + 1100 - Date.now());
	if (wait) await new Promise((r) => setTimeout(r, wait));
	lastRequestAt = Date.now();

	try {
		const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
		const res = await fetch(url, { headers: { Accept: 'application/json' } });
		if (!res.ok) throw new Error(`geocode ${res.status}`);
		const results = (await res.json()) as {
			display_name: string;
			lon: string;
			lat: string;
			type: string;
		}[];
		if (!results.length) {
			cache.set(key, null);
			return null;
		}
		const r = results[0];
		const out: GeocodeResult = {
			name: r.display_name.split(',').slice(0, 2).join(','),
			center: [parseFloat(r.lon), parseFloat(r.lat)],
			zoom: r.type === 'city' || r.type === 'administrative' ? 11 : 13
		};
		cache.set(key, out);
		return out;
	} catch {
		// partial-match fallback
		for (const [k, v] of Object.entries(FALLBACKS)) {
			if (key.includes(k)) return v;
		}
		return null;
	}
}

const reverseCache = new Map<string, string | null>();

/** Coarse reverse geocode for context enrichment (zoom 10, cached by rounded coords). */
export async function reverseGeocode(center: [number, number]): Promise<string | null> {
	const key = `${center[0].toFixed(1)},${center[1].toFixed(1)}`;
	if (reverseCache.has(key)) return reverseCache.get(key) ?? null;
	try {
		const wait = Math.max(0, lastRequestAt + 1100 - Date.now());
		if (wait) await new Promise((r) => setTimeout(r, wait));
		lastRequestAt = Date.now();
		const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lon=${center[0]}&lat=${center[1]}`;
		const res = await fetch(url, { headers: { Accept: 'application/json' } });
		if (!res.ok) throw new Error(`reverse ${res.status}`);
		const data = (await res.json()) as { display_name?: string };
		const name = data.display_name?.split(',').slice(0, 3).join(',') ?? null;
		reverseCache.set(key, name);
		return name;
	} catch {
		reverseCache.set(key, null);
		return null;
	}
}
