/**
 * Pure-code screening: point-in-polygon basin assignment, site scoring via
 * the shared arithmetic, and the PortfolioStats grounding object. No LLM.
 */

import {
	classLabel,
	INDICATOR_BY_CODE,
	INDICATORS,
	overallScore,
	polygonBounds,
	riskClassIndex,
	NO_DATA,
	type IndicatorCode
} from '../shared/waterRisk';
import type { BasinStat, PortfolioStats } from './schema';

export interface Site {
	rowId: number;
	name: string;
	lon: number;
	lat: number;
	country?: string;
	sector?: string;
	repaired: boolean;
}

export interface ScreenedSite extends Site {
	basinId: string | null;
	basinName: string | null;
	overall: number | null;
	classIndex: number | null;
}

type Ring = [number, number][];

function inRing(pt: [number, number], ring: Ring): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i];
		const [xj, yj] = ring[j];
		if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi)
			inside = !inside;
	}
	return inside;
}

function inPolygon(pt: [number, number], poly: Ring[]): boolean {
	if (!inRing(pt, poly[0])) return false;
	for (let h = 1; h < poly.length; h++) if (inRing(pt, poly[h])) return false; // hole
	return true;
}

export function pointInFeature(pt: [number, number], f: GeoJSON.Feature): boolean {
	if (f.geometry.type === 'Polygon') return inPolygon(pt, f.geometry.coordinates as Ring[]);
	if (f.geometry.type === 'MultiPolygon')
		return (f.geometry.coordinates as Ring[][]).some((poly) => inPolygon(pt, poly));
	return false;
}

interface IndexedBasin {
	f: GeoJSON.Feature;
	id: string;
	name: string;
	bbox: [[number, number], [number, number]];
	overall: number;
	values: Partial<Record<IndicatorCode, number>>;
}

export function indexBasins(fc: GeoJSON.FeatureCollection): IndexedBasin[] {
	return fc.features.map((f) => {
		const p = f.properties as Record<string, unknown>;
		const values: Partial<Record<IndicatorCode, number>> = {};
		for (const d of INDICATORS) {
			const v = p[d.code];
			if (typeof v === 'number') values[d.code] = v;
		}
		return {
			f,
			id: String(p.id),
			name: String(p.name),
			bbox: polygonBounds(f),
			overall: overallScore(values).overall,
			values
		};
	});
}

export function screenSites(sites: Site[], basins: IndexedBasin[]): ScreenedSite[] {
	return sites.map((s) => {
		const pt: [number, number] = [s.lon, s.lat];
		const hit = basins.find(
			(b) =>
				pt[0] >= b.bbox[0][0] &&
				pt[0] <= b.bbox[1][0] &&
				pt[1] >= b.bbox[0][1] &&
				pt[1] <= b.bbox[1][1] &&
				pointInFeature(pt, b.f)
		);
		if (!hit) return { ...s, basinId: null, basinName: null, overall: null, classIndex: null };
		return {
			...s,
			basinId: hit.id,
			basinName: hit.name,
			overall: hit.overall,
			classIndex: riskClassIndex(hit.overall)
		};
	});
}

export function computeStats(
	screened: ScreenedSite[],
	excluded: { needsReview: number; rejectedRepairs: number; duplicates: number },
	basins: IndexedBasin[],
	totalRows: number
): PortfolioStats {
	const covered = screened.filter((s) => s.basinId !== null);
	const noCoverage = screened.length - covered.length;

	const sitesByClass: Record<string, number> = {};
	for (const s of covered) {
		const label = classLabel(s.classIndex!);
		sitesByClass[label] = (sitesByClass[label] ?? 0) + 1;
	}

	const byBasin = new Map<string, ScreenedSite[]>();
	for (const s of covered) {
		const list = byBasin.get(s.basinId!) ?? [];
		list.push(s);
		byBasin.set(s.basinId!, list);
	}
	const topBasins: BasinStat[] = [...byBasin.entries()]
		.map(([basinId, sites]) => {
			const basin = basins.find((b) => b.id === basinId)!;
			const worstIndicators = INDICATORS.map((d) => ({
				code: d.code,
				label: d.label,
				score: basin.values[d.code] ?? NO_DATA
			}))
				.filter((x) => x.score !== NO_DATA)
				.toSorted((a, b) => b.score - a.score)
				.slice(0, 3)
				.map((x) => ({ ...x, label: INDICATOR_BY_CODE[x.code as IndicatorCode].label }));
			const sectors: Record<string, number> = {};
			for (const s of sites) {
				const sec = s.sector || 'unspecified';
				sectors[sec] = (sectors[sec] ?? 0) + 1;
			}
			return {
				basinId,
				name: basin.name,
				siteCount: sites.length,
				overall: Number(basin.overall.toFixed(2)),
				classLabel: classLabel(riskClassIndex(basin.overall)),
				worstIndicators,
				sectors
			};
		})
		.toSorted((a, b) => b.siteCount * b.overall - a.siteCount * a.overall)
		.slice(0, 8);

	const sectorBreakdown: Record<string, { sites: number; avgScore: number }> = {};
	for (const s of covered) {
		const sec = s.sector || 'unspecified';
		const cur = sectorBreakdown[sec] ?? { sites: 0, avgScore: 0 };
		cur.avgScore = (cur.avgScore * cur.sites + (s.overall ?? 0)) / (cur.sites + 1);
		cur.sites += 1;
		sectorBreakdown[sec] = cur;
	}
	for (const sec of Object.keys(sectorBreakdown))
		sectorBreakdown[sec].avgScore = Number(sectorBreakdown[sec].avgScore.toFixed(2));

	const notes: string[] = [];
	if (noCoverage > 0)
		notes.push(
			`${noCoverage} site(s) fall outside the basin dataset entirely (no coverage) — unscreened, not safe. The classic islands/edge gap.`
		);
	if (excluded.needsReview > 0)
		notes.push(`${excluded.needsReview} row(s) excluded pending review — not counted in any stat.`);

	return {
		totalRows,
		screenedSites: covered.length,
		noCoverageSites: noCoverage,
		excluded,
		sitesByClass,
		topBasins,
		sectorBreakdown,
		notes
	};
}
