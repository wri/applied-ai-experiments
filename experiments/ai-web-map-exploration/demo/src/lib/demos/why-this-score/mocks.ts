import type { MockSpec } from '$lib/llm/types';
import {
	dominantDrivers,
	INDICATOR_BY_CODE,
	riskClass,
	type Decomposition,
	type IndicatorCode
} from '../shared/waterRisk';
import type { Audience, ChecklistItem } from './schema';

/**
 * Both mocks compose from the same decomposition sent live, so keyless mode
 * exercises the identical arithmetic-in / explanation-out contract.
 */

export function narrativeMock(
	props: Record<string, unknown>,
	decomp: Decomposition,
	audience: Audience
): MockSpec {
	return {
		kind: 'fn',
		run: () => {
			const cls = riskClass(decomp.overall);
			const drivers = dominantDrivers(decomp, 3);
			const noData = decomp.contributions.filter((c) => c.noData);
			const top = drivers[0];
			const topDef = INDICATOR_BY_CODE[top.code];
			const name = String(props.name);
			const stale = props.stale
				? `This score has not moved year-over-year — not because conditions are static, but because its inputs are: ${String(props.stale_note).replace(' (fictional).', '.')} `
				: '';

			if (audience === 'board') {
				return (
					stale +
					`${name} sits in the ${cls.label.toLowerCase()} water-risk class. The main pressure is ${topDef.label.toLowerCase()}, which contributes more to the score than any other factor. Practically, that means diligence here should start with ${topDef.group === 'quantity' ? 'water availability and supply reliability' : topDef.group === 'quality' ? 'source-water quality and treatment needs' : 'the regulatory and community context'} before any commitment. (mock response)`
				);
			}
			if (audience === 'analyst') {
				const driverBits = drivers
					.map(
						(c) =>
							`${INDICATOR_BY_CODE[c.code].label.toLowerCase()} at ${c.value.toFixed(1)} (contributes ${c.weighted.toFixed(2)})`
					)
					.join(', ');
				const nd = noData.length
					? ` Note ${noData.map((c) => INDICATOR_BY_CODE[c.code].label.toLowerCase()).join(', ')} ${noData.length > 1 ? 'are' : 'is'} missing (-9999) — excluded and reweighted, which is insufficient data, not zero risk.`
					: '';
				return (
					stale +
					`${name} scores ${decomp.overall.toFixed(2)} (${cls.label}), driven by ${driverBits}.${nd} The score is a long-term screening average: it does not capture seasonal timing within the year, local infrastructure, or legal availability of water. (mock response)`
				);
			}
			// technical
			const groupBits = decomp.groups
				.map((g) => `${g.label.toLowerCase()} ${g.score.toFixed(2)} × ${g.weight.toFixed(2)}`)
				.join('; ');
			const renorm = noData.length
				? ` With ${noData.map((c) => c.code).join(', ')} at -9999, remaining weights renormalize so the headline stays on the 0–5 scale — the printed contributions sum to the total exactly.`
				: ' All 13 indicators are present, so no renormalization applies.';
			const prov = drivers
				.map((c) => {
					const p = INDICATOR_BY_CODE[c.code].provenance;
					return `${c.code} (${p.method}, ${p.vintage}, ${p.resolutionLabel})`;
				})
				.join(', ');
			return (
				stale +
				`Overall ${decomp.overall.toFixed(2)} = Σ value × renormalized weight across available indicators. Group view: ${groupBits}.${renorm} Dominant contributions: ${drivers.map((c) => `${c.code} ${c.value.toFixed(1)} × ${c.weight.toFixed(3)} = ${c.weighted.toFixed(3)}`).join('; ')}. Driver provenance: ${prov} — the coarsest of these bounds what zoom level this score can honestly support. (mock response)`
			);
		}
	};
}

const CHECKLIST_LIBRARY: Partial<
	Record<IndicatorCode, Omit<ChecklistItem, 'driver' | 'rationale'>>
> = {
	bws: {
		action: 'Collect actual abstraction volumes for the major upstream users',
		who: 'irrigation district & utility operators',
		effort: 'agency-contact'
	},
	bwd: {
		action: 'Verify return-flow assumptions against the largest consumptive users',
		who: 'provincial water resources authority',
		effort: 'agency-contact'
	},
	gtd: {
		action: 'Obtain the last 5 years of well-level records near the site',
		who: 'provincial water resources authority (DONRE)',
		effort: 'agency-contact'
	},
	iav: {
		action: 'Compare dry-year supply records against site demand projections',
		who: 'site engineering team',
		effort: 'desk'
	},
	sev: {
		action: 'Check the critical low-flow months against intake and storage capacity',
		who: 'site engineering team',
		effort: 'desk'
	},
	rfr: {
		action: 'Compare the modelled flood band against commune flood-mark history',
		who: 'commune records / local flood committee',
		effort: 'field'
	},
	cfr: {
		action: 'Verify dike and drainage protection status for the site polygon',
		who: 'provincial dike management office',
		effort: 'agency-contact'
	},
	drr: {
		action: 'Review drought declarations and curtailments over the past decade',
		who: 'provincial agriculture office',
		effort: 'desk'
	},
	ucw: {
		action: 'Sample source water upstream and downstream of the nearest outfalls',
		who: 'accredited environmental lab',
		effort: 'field'
	},
	cep: {
		action: 'Check nutrient monitoring records for the receiving coastal waters',
		who: 'provincial environment office',
		effort: 'agency-contact'
	},
	udw: {
		action: 'Cross-check WASH coverage statistics for surrounding communes',
		who: 'district health office',
		effort: 'desk'
	},
	usa: {
		action: 'Cross-check sanitation coverage statistics for surrounding communes',
		who: 'district health office',
		effort: 'desk'
	},
	rri: {
		action: 'Review current water permitting status and any local conflict reporting',
		who: 'legal counsel + local media review',
		effort: 'desk'
	}
};

export function checklistMock(decomp: Decomposition): MockSpec {
	return {
		kind: 'fn',
		run: () => {
			const drivers = dominantDrivers(decomp, 3);
			const noData = decomp.contributions.filter((c) => c.noData);
			const items: ChecklistItem[] = drivers.map((c) => {
				const def = INDICATOR_BY_CODE[c.code];
				const base = CHECKLIST_LIBRARY[c.code]!;
				return {
					driver: c.code,
					...base,
					rationale: `${def.label} is a dominant driver here (${c.value.toFixed(1)}, contributes ${c.weighted.toFixed(2)}) and is ${def.provenance.method} at ${def.provenance.resolutionLabel} — verify it locally before acting.`
				};
			});
			for (const c of noData.slice(0, 1)) {
				const def = INDICATOR_BY_CODE[c.code];
				const base = CHECKLIST_LIBRARY[c.code]!;
				items.push({
					driver: c.code,
					...base,
					rationale: `${def.label} is missing here (-9999): the global layer has insufficient data, so this can ONLY be answered locally.`
				});
			}
			const oldest = Math.min(...drivers.map((c) => INDICATOR_BY_CODE[c.code].provenance.vintage));
			items.push({
				driver: 'general',
				action: `Confirm nothing material changed since the oldest driver vintage (${oldest})`,
				who: 'data team',
				rationale: 'Screening scores are periodic snapshots; recent infrastructure or drought events may not be reflected.',
				effort: 'desk'
			});
			return JSON.stringify({ items: items.slice(0, 6) });
		}
	};
}
