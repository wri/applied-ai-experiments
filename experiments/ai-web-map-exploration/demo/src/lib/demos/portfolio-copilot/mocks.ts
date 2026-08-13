import { extractJson } from '$lib/llm/structured';
import { lastUserText, type LlmRequest, type MockSpec } from '$lib/llm/types';
import type { CsvRow } from './csv';
import { guessColumns } from './csv';
import type { PortfolioStats, RepairResult, RowChange, RowRepair } from './schema';

/**
 * The repair mock parses the ACTUAL flagged rows out of the request and runs
 * deterministic fixers over whatever it receives — it repairs any CSV with
 * these defect classes, not just the bundled sample. Keyless mode exercises
 * the identical schema-validation path and review UI.
 */

const DMS = /^(\d+)\s*[°d]\s*(\d+)\s*['m]\s*([\d.]+)?\s*["s]?\s*([NSEW])$/i;
const DECIMAL_COMMA = /^-?\d+,\d+$/;
const PLAIN = /^-?\d+(\.\d+)?$/;
const MOJIBAKE = /Ã|Â|áº|á»|Æ¡|Æ°/;
const REGION = { lonMin: 100, lonMax: 112, latMin: 6, latMax: 24 };

function dmsToDecimal(s: string): number | null {
	const m = s.match(DMS);
	if (!m) return null;
	const v = Number(m[1]) + Number(m[2]) / 60 + Number(m[3] ?? 0) / 3600;
	return /[SW]/i.test(m[4]) ? -v : v;
}

function fixMojibake(s: string): string | null {
	try {
		const fixed = decodeURIComponent(escape(s));
		return fixed !== s ? fixed : null;
	} catch {
		return null;
	}
}

function section(text: string, label: string): string | null {
	const m = text.match(new RegExp(`${label}: (\\[.*?\\])(?:\\n|$)`, 's'));
	return m ? m[1] : null;
}

export function repairMock(): MockSpec {
	return {
		kind: 'fn',
		run: (req: LlmRequest) => {
			const user = lastUserText(req);
			const headers = JSON.parse(section(user, 'HEADERS') ?? '[]') as string[];
			const flagged = JSON.parse(section(user, 'FLAGGED ROWS') ?? '[]') as CsvRow[];
			const mapping = guessColumns({ headers, rows: [], delimiter: ',' });
			const latIdx = mapping.lat ? headers.indexOf(mapping.lat) : -1;
			const lonIdx = mapping.lon ? headers.indexOf(mapping.lon) : -1;
			const nameIdx = mapping.name ? headers.indexOf(mapping.name) : -1;

			const rows: RowRepair[] = flagged.map((row) => {
				const rawLat = latIdx >= 0 ? (row.cells[latIdx] ?? '') : '';
				const rawLon = lonIdx >= 0 ? (row.cells[lonIdx] ?? '') : '';
				const rawName = nameIdx >= 0 ? (row.cells[nameIdx] ?? '') : '';
				const changes: RowChange[] = [];
				let lat: number | null = null;
				let lon: number | null = null;
				let repairedName: string | undefined;

				// name mojibake (independent of coordinates)
				if (MOJIBAKE.test(rawName)) {
					const fixed = fixMojibake(rawName);
					if (fixed) {
						repairedName = fixed;
						changes.push({
							field: 'name',
							from: rawName.slice(0, 60),
							to: fixed.slice(0, 60),
							reason: 'UTF-8 text was read as Latin-1 (mojibake)'
						});
					}
				}

				if (rawLat === '' || rawLon === '') {
					return {
						rowId: row.id,
						disposition: 'needs-review',
						reviewReason: 'coordinates are missing; name alone is too ambiguous to geolocate'
					};
				}

				const parseCoord = (raw: string, field: 'lat' | 'lon'): number | null => {
					if (PLAIN.test(raw)) return Number(raw);
					const dms = dmsToDecimal(raw);
					if (dms !== null) {
						changes.push({
							field,
							from: raw.slice(0, 60),
							to: dms.toFixed(4),
							reason: 'degrees-minutes-seconds converted to decimal degrees'
						});
						return dms;
					}
					if (DECIMAL_COMMA.test(raw)) {
						const v = Number(raw.replace(',', '.'));
						changes.push({
							field,
							from: raw,
							to: v.toFixed(4),
							reason: 'decimal comma converted to decimal point'
						});
						return v;
					}
					return null;
				};

				lat = parseCoord(rawLat, 'lat');
				lon = parseCoord(rawLon, 'lon');
				if (lat === null || lon === null) {
					return {
						rowId: row.id,
						disposition: 'needs-review',
						reviewReason: `could not parse coordinates ("${rawLat}", "${rawLon}")`
					};
				}

				// swapped pair: invalid as (lat, lon) but valid swapped and in-region
				const inRegion = (la: number, lo: number) =>
					la >= REGION.latMin && la <= REGION.latMax && lo >= REGION.lonMin && lo <= REGION.lonMax;
				if ((Math.abs(lat) > 90 || !inRegion(lat, lon)) && inRegion(lon, lat)) {
					changes.push({
						field: 'lat',
						from: String(lat),
						to: String(lon),
						reason: 'latitude/longitude appear transposed'
					});
					[lat, lon] = [lon, lat];
				}

				if (Math.abs(lat) > 90) {
					return {
						rowId: row.id,
						disposition: 'needs-review',
						reviewReason: `latitude ${lat} is out of range and no safe swap applies`
					};
				}

				if (changes.length === 0) return { rowId: row.id, disposition: 'ok' };
				return {
					rowId: row.id,
					disposition: 'repaired',
					repairedLat: Number(lat.toFixed(4)),
					repairedLon: Number(lon.toFixed(4)),
					...(repairedName ? { repairedName } : {}),
					changes
				};
			});

			const result: RepairResult = { mapping, rows };
			return JSON.stringify(result);
		}
	};
}

/**
 * The Q&A mock extracts the same PORTFOLIO STATS JSON the live call receives
 * from the system prompt and composes grounded markdown — real numbers, real
 * basin names, real [[basin:…]] markers — so chips, fly-tos, and the
 * grounding guard run identically keyless.
 */
export function qaMock(): MockSpec {
	return {
		kind: 'fn',
		run: (req: LlmRequest) => {
			const sys = req.system ?? '';
			const raw = extractJson(sys.slice(sys.indexOf('PORTFOLIO STATS:')));
			if (!raw) return 'I could not find the portfolio stats to answer from. (mock response)';
			const stats = JSON.parse(raw) as PortfolioStats;
			const q = lastUserText(req).toLowerCase();
			const top = stats.topBasins;
			const cite = (b: { basinId: string; name: string }) => `**${b.name}** [[basin:${b.basinId}]]`;
			const highCount = (stats.sitesByClass['High'] ?? 0) + (stats.sitesByClass['Extremely high'] ?? 0);

			if (/board|summar|executive|brief/.test(q)) {
				const b0 = top[0];
				return (
					`Of ${stats.screenedSites} screened sites, **${highCount}** sit in high or extremely-high water-risk basins. ` +
					`Exposure concentrates in ${cite(b0)} (${b0.siteCount} sites, ${b0.classLabel.toLowerCase()}), where the leading pressure is ${b0.worstIndicators[0]?.label.toLowerCase()}. ` +
					(stats.noCoverageSites > 0
						? `**${stats.noCoverageSites} sites could not be screened** (outside the dataset's coverage) and need separate review. `
						: '') +
					`Recommended next step: local validation in the top ${Math.min(3, top.length)} basins before disclosure. (mock response)`
				);
			}
			if (/flood/.test(q)) {
				const floody = top.filter((b) =>
					b.worstIndicators.some((w) => w.code === 'rfr' || w.code === 'cfr')
				);
				if (!floody.length)
					return `None of your top-exposure basins have flood risk among their leading indicators — flood is not what drives this portfolio's screening result. (mock response)`;
				return (
					`Flood risk leads in ${floody.length} of your top basins: ` +
					floody
						.slice(0, 3)
						.map(
							(b) =>
								`${cite(b)} (${b.siteCount} sites — ${b.worstIndicators.find((w) => w.code === 'rfr' || w.code === 'cfr')?.label.toLowerCase()} ${b.worstIndicators.find((w) => w.code === 'rfr' || w.code === 'cfr')?.score.toFixed(1)})`
						)
						.join(', ') +
					`. These basins' flood scores come from modelled inundation with no levee data — verify local protection before acting. (mock response)`
				);
			}
			if (/no data|coverage|missing|screen/.test(q) && /why|no|not/.test(q)) {
				return (
					(stats.noCoverageSites > 0
						? `**${stats.noCoverageSites} sites** fall outside the basin dataset entirely — no sub-basin polygon contains them, so they are *unscreened, not safe*. `
						: `All sites with usable coordinates found a basin. `) +
					(stats.excluded.needsReview > 0
						? `A further ${stats.excluded.needsReview} rows were excluded pending your review (unfixable coordinates), and ${stats.excluded.duplicates} exact duplicates were removed by code before any AI touched the file. `
						: '') +
					`Within covered basins, some indicators are themselves -9999 (insufficient data) — the basin scores renormalize around them. (mock response)`
				);
			}
			if (/basin|drive|highest|risk|where/.test(q)) {
				return (
					`Your exposure is driven by ` +
					top
						.slice(0, 3)
						.map(
							(b) =>
								`${cite(b)} — ${b.siteCount} sites in a ${b.classLabel.toLowerCase()} basin (${b.overall}), led by ${b.worstIndicators[0]?.label.toLowerCase()}`
						)
						.join('; ') +
					`. Together the top 3 basins hold ${top.slice(0, 3).reduce((s, b) => s + b.siteCount, 0)} of your ${stats.screenedSites} screened sites. (mock response)`
				);
			}
			// fallback: portfolio overview
			return (
				`${stats.screenedSites} of ${stats.totalRows} rows screened (${stats.excluded.duplicates} duplicates removed by code, ${stats.excluded.needsReview} pending review, ${stats.noCoverageSites} without basin coverage). ` +
				`Risk classes: ${Object.entries(stats.sitesByClass)
					.map(([k, v]) => `${k} ${v}`)
					.join(', ')}. Highest concentration: ${top[0] ? cite(top[0]) : '—'} with ${top[0]?.siteCount ?? 0} sites. (mock response)`
			);
		}
	};
}
