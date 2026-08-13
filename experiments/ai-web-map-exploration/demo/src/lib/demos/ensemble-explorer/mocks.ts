import type { MockSpec } from '$lib/llm/types';
import {
	bimodalGap,
	ensembleValues,
	MODEL_LABELS,
	riskClass,
	SCENARIO_LABELS,
	type Agreement,
	type EnsembleModel,
	type ScenarioPrefix
} from '../shared/waterRisk';
import type { DivergenceNote, GuidanceReport } from './schema';

/**
 * The mock closes over the same basin props sent live and composes guidance
 * deterministically from the actual per-model numbers — keyless mode runs the
 * identical numbers-in / decision-language-out division of labor.
 */
export function guidanceMock(props: Record<string, unknown>, prefix: ScenarioPrefix): MockSpec {
	return {
		kind: 'fn',
		run: () => {
			const values = ensembleValues(props, prefix);
			const mean = Number(props[`${prefix}_mean`]);
			const range = Number(props[`${prefix}_range`]);
			const agreement = props[`${prefix}_agreement`] as Agreement;
			const name = String(props.name);
			const scenario = SCENARIO_LABELS[prefix].toLowerCase();
			const cls = riskClass(mean).label.toLowerCase();

			const entries = (Object.entries(values) as [EnsembleModel, number][]).toSorted(
				(a, b) => b[1] - a[1]
			);
			const [maxModel, maxV] = entries[0];
			const [minModel, minV] = entries.at(-1)!;
			const gap = bimodalGap(values);
			const bimodal = gap.gap > 1.5 && mean > gap.gapLo && mean < gap.gapHi;
			const lowCount = entries.filter(([, v]) => v <= gap.gapLo).length;
			const highCount = entries.length - lowCount;

			const divergence: DivergenceNote[] = entries.map(([m, v]) => ({
				model: m,
				position: v > mean + 0.3 ? 'drier' : v < mean - 0.3 ? 'wetter' : 'middle',
				note:
					v > mean + 0.3
						? `${MODEL_LABELS[m]} sees ${v.toFixed(2)} — ${(v - mean).toFixed(1)} above the ensemble mean.`
						: v < mean - 0.3
							? `${MODEL_LABELS[m]} sees ${v.toFixed(2)} — ${(mean - v).toFixed(1)} below the ensemble mean.`
							: `${MODEL_LABELS[m]} sits near the mean at ${v.toFixed(2)}.`
			}));

			let headline: string;
			let signal: string;
			let screening: string;
			let siting: string;
			let resolve: string[];
			let confidence: GuidanceReport['confidence'];

			if (bimodal) {
				headline = `${name}: the ensemble mean is a value no model predicts`;
				signal = `The five models split into two camps: ${highCount} see high stress (up to ${maxV.toFixed(2)}) while ${lowCount} see low stress (down to ${minV.toFixed(2)}). The mean of ${mean.toFixed(2)} (${cls}) falls in the ${gap.gap.toFixed(1)}-point gap between the camps — it describes neither.`;
				screening = `Flag for review, but do not rank this basin against high-agreement basins by its mean — the mean is an artifact of averaging two contradictory stories about the ${scenario} water balance.`;
				siting = `Do not commit capital on this signal alone. The models disagree about the fundamental state of this basin; treat the high camp (${MODEL_LABELS[maxModel]} at ${maxV.toFixed(2)}) as the planning case until local evidence rules it out.`;
				resolve = [
					'Commission a local water-balance assessment to determine which model camp matches observed conditions.',
					'Compare recent river-gauge and well records against each camp before relying on either.'
				];
				confidence = 'low';
			} else if (agreement === 'low') {
				headline = `${name}: models disagree — treat the mean with caution`;
				signal = `Ensemble mean ${mean.toFixed(2)} (${cls}), but the models span ${minV.toFixed(2)} (${MODEL_LABELS[minModel]}) to ${maxV.toFixed(2)} (${MODEL_LABELS[maxModel]}) — a ${range.toFixed(1)}-point spread on a 5-point scale for the ${scenario}.`;
				screening = `Usable to flag the basin for a closer look; carry the full ${minV.toFixed(2)}–${maxV.toFixed(2)} span into portfolio review rather than the single mean.`;
				siting = `Not decision-grade alone. A siting case should stress-test against ${MODEL_LABELS[maxModel]}'s ${maxV.toFixed(2)} as the adverse scenario and identify which local factors the models treat differently.`;
				resolve = [
					'Obtain local abstraction and streamflow records to constrain which end of the model span is realistic.',
					'Monitor seasonal low-flow months for one hydrological year before committing.'
				];
				confidence = 'low';
			} else if (agreement === 'medium') {
				headline = `${name}: moderate model spread around ${cls} stress`;
				signal = `Ensemble mean ${mean.toFixed(2)} (${cls}); models range ${minV.toFixed(2)}–${maxV.toFixed(2)} for the ${scenario}. The models agree on the story's direction but not its severity.`;
				screening = `Reliable for screening: all models place the basin in or near the ${cls} band.`;
				siting = `Usable with a margin: design for the upper end (${maxV.toFixed(2)}, ${MODEL_LABELS[maxModel]}) rather than the mean, and verify the severity locally.`;
				resolve = ['Validate the severity with recent local supply and demand records.'];
				confidence = 'medium';
			} else {
				headline = `${name}: models agree — ${cls} stress`;
				signal = `All five models fall within ${range.toFixed(1)} points (${minV.toFixed(2)}–${maxV.toFixed(2)}) around a mean of ${mean.toFixed(2)} for the ${scenario}. This is a consistent signal.`;
				screening = `Screening and ranking can rely on the ensemble mean for this basin.`;
				siting = `The ensemble supports siting analysis; residual uncertainty is about local, sub-basin conditions the global models cannot see.`;
				resolve = ['Confirm sub-basin conditions (intake location, seasonal timing) with local records.'];
				confidence = 'high';
			}

			const report: GuidanceReport = {
				headline: headline.slice(0, 90),
				signal_summary: signal,
				screening_take: screening,
				siting_take: siting,
				divergence,
				what_would_resolve: resolve,
				confidence
			};
			return JSON.stringify(report);
		}
	};
}
