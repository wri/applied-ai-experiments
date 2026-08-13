/**
 * Pure decomposition logic: extract indicator values from basin props, wrap
 * the shared overallScore arithmetic, and serialize it into the prompt block
 * the narrative call receives — the model gets the arithmetic, not vibes.
 */

import {
	dominantDrivers,
	fmtScore,
	GROUPS,
	INDICATOR_BY_CODE,
	INDICATORS,
	NO_DATA,
	overallScore,
	riskClass,
	scaleVerdict,
	type Contribution,
	type Decomposition,
	type GroupWeights,
	type IndicatorCode,
	type ScaleVerdict
} from '../shared/waterRisk';

export function indicatorValues(
	props: Record<string, unknown>
): Partial<Record<IndicatorCode, number>> {
	const out: Partial<Record<IndicatorCode, number>> = {};
	for (const d of INDICATORS) {
		const v = props[d.code];
		if (typeof v === 'number') out[d.code] = v;
	}
	return out;
}

export function decompose(
	props: Record<string, unknown>,
	weights?: GroupWeights
): Decomposition {
	return overallScore(indicatorValues(props), weights);
}

/** coarsest native resolution among the dominant drivers — what the scale verdict compares against */
export function coarsestDriverResolution(decomp: Decomposition): {
	resolutionM: number;
	code: IndicatorCode;
} {
	let worst = { resolutionM: 0, code: 'bws' as IndicatorCode };
	for (const c of dominantDrivers(decomp, 3)) {
		const r = INDICATOR_BY_CODE[c.code].provenance.resolutionM;
		if (r > worst.resolutionM) worst = { resolutionM: r, code: c.code };
	}
	return worst;
}

export function driverScaleVerdict(
	decomp: Decomposition,
	metersPerPixel: number
): ScaleVerdict & { resolutionM: number; code: IndicatorCode } {
	const worst = coarsestDriverResolution(decomp);
	return { ...scaleVerdict(metersPerPixel, worst.resolutionM), ...worst };
}

function contributionLine(c: Contribution): string {
	const d = INDICATOR_BY_CODE[c.code];
	if (c.noData) {
		return `  ${c.code} ${d.label.padEnd(34)} NO DATA (${NO_DATA}) — excluded, weights renormalized. NOT zero risk.`;
	}
	return `  ${c.code} ${d.label.padEnd(34)} value ${c.value.toFixed(1)} × w ${c.weight.toFixed(3)} = ${c.weighted.toFixed(3)}`;
}

/** the plain-text arithmetic block embedded in every narrative prompt */
export function serializeDecomposition(
	props: Record<string, unknown>,
	decomp: Decomposition,
	metersPerPixel: number
): string {
	const lines: string[] = [];
	const cls = riskClass(decomp.overall);
	lines.push(
		`BASIN: ${props.name} (${props.id}) — overall ${decomp.overall.toFixed(2)} → ${cls.label} (class ${decomp.overallClass + 1}/5)`
	);
	if (props.stale) lines.push(`STALE SCORE: ${props.stale_note}`);
	lines.push(`ARITHMETIC (weights renormalized over available indicators):`);
	for (const [g, def] of Object.entries(GROUPS)) {
		const group = decomp.groups.find((x) => x.id === g)!;
		lines.push(`${def.label} (group weight ${group.weight.toFixed(2)}):`);
		for (const c of decomp.contributions) {
			if (INDICATOR_BY_CODE[c.code].group === g) lines.push(contributionLine(c));
		}
	}
	lines.push(`TOTAL: ${decomp.overall.toFixed(2)}`);

	const drivers = dominantDrivers(decomp, 3);
	lines.push(
		`DOMINANT DRIVERS: ` +
			drivers
				.map(
					(c) =>
						`${c.code} ${INDICATOR_BY_CODE[c.code].label} (${fmtScore(c.value)}, contributes ${c.weighted.toFixed(2)})`
				)
				.join(', ')
	);
	lines.push(
		`PROVENANCE OF DRIVERS: ` +
			drivers
				.map((c) => {
					const p = INDICATOR_BY_CODE[c.code].provenance;
					return `${c.code} — ${p.method}, ${p.vintage} vintage, ${p.resolutionLabel}`;
				})
				.join('; ')
	);

	const verdict = driverScaleVerdict(decomp, metersPerPixel);
	lines.push(
		`VIEW SCALE: ${Math.round(metersPerPixel)} m/px — one native cell of ${verdict.code} (${INDICATOR_BY_CODE[verdict.code].provenance.resolutionLabel}) spans ~${Math.round(verdict.cellSpanPx)} screen px → ${verdict.level === 'screening' ? 'screening-grade view' : verdict.level === 'caution' ? 'approaching the data grain — caution' : 'NOT decision-grade at this zoom'}`
	);
	lines.push(`DATA: MODELLED demonstration values (fictional basins).`);
	return lines.join('\n');
}
