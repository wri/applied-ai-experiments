import type { MockSpec } from '$lib/llm/types';
import { humanize } from '$lib/map/hover';
import type { AnomalyStop, Candidate } from './anomalies';

/**
 * The mock closes over the real computed candidates and templates its picks
 * and explanations from the actual z-scores — keyless mode runs the same
 * detect-in-code / explain-from-numbers division of labor as live mode.
 */
export function anomalyMock(cands: Candidate[]): MockSpec {
	return {
		kind: 'fn',
		run: () => {
			const stops: AnomalyStop[] = cands.slice(0, 5).map((c) => {
				const changeLed = c.changeZ >= c.embedZ;
				const z = Math.max(c.changeZ, c.embedZ);
				const cat = humanize(c.category);
				return {
					id: c.id,
					headline: changeLed
						? `${c.name}: unusually high change activity for a ${cat}`.slice(0, 80)
						: `${c.name}: does not sit with other ${cat}s`.slice(0, 80),
					why: changeLed
						? `change_score ${c.changeScore.toFixed(2)} is ${c.changeZ.toFixed(1)}σ above the ${cat} median — the surrounding ${cat}s are near-static, so this one is worth a look.`
						: `its embedding sits ${c.embedZ.toFixed(1)}σ from the ${cat} cluster centroid — whatever this place is, it does not look like a typical ${cat}.`,
					confidence: z > 3 ? 'high' : z > 2 ? 'medium' : 'low'
				};
			});
			return JSON.stringify({ stops });
		}
	};
}
