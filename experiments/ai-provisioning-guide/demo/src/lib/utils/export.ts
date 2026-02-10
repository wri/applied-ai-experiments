import type { MethodId, MethodViability, MethodTCO, MethodTCOExpanded } from '../types.js';
import { methods } from '../data/methods.js';
import { constraintQuestions } from '../data/constraints.js';
import { formatCurrency, formatCostPerRequest } from './format.js';

interface ExportState {
  constraintAnswers: Record<string, string | undefined>;
  viabilityMap: Map<MethodId, MethodViability>;
  sortedMethods: MethodId[];
  tcoResults: MethodTCO[];
  tcoResultsExpanded: MethodTCOExpanded[];
  timeHorizonMonths: number;
  tcoInputs: { monthlyVolume: number; avgInputTokens: number; avgOutputTokens: number };
  selectedMethods: MethodId[];
  insights: string[];
}

/**
 * Export decision summary as Markdown.
 */
export function exportToMarkdown(state: ExportState): string {
  const lines: string[] = [];
  lines.push('# AI Provisioning Decision Summary\n');
  lines.push(`_Generated ${new Date().toLocaleDateString()}_\n`);

  // Constraint answers
  lines.push('## Constraints\n');
  for (const question of constraintQuestions) {
    const answerId = state.constraintAnswers[question.id];
    const option = answerId ? question.options.find((o) => o.id === answerId) : null;
    lines.push(`- **${question.title}** ${option ? option.label : '_Not answered_'}`);
  }

  // Viability results
  lines.push('\n## Method Viability\n');
  for (const methodId of state.sortedMethods) {
    const method = methods.find((m) => m.id === methodId);
    const viability = state.viabilityMap.get(methodId);
    if (!method || !viability) continue;

    const icon = viability.viability === 'viable' ? '**Viable**' : viability.viability === 'caution' ? '**Caution**' : '~~Eliminated~~';
    lines.push(`- ${method.shortName}: ${icon}`);
    for (const reason of viability.reasons) {
      lines.push(`  - ${reason}`);
    }
  }

  // TCO summary
  if (state.tcoResultsExpanded.length > 0) {
    const h = state.timeHorizonMonths;
    lines.push('\n## TCO Comparison\n');
    lines.push(`Volume: ${state.tcoInputs.monthlyVolume.toLocaleString()} requests/mo | Input: ${state.tcoInputs.avgInputTokens} tokens | Output: ${state.tcoInputs.avgOutputTokens} tokens | Horizon: ${h} months\n`);
    lines.push(`| Method | Setup (one-time) | Monthly Recurring | Inference | Infra | Ops | ${h}-mo Total | $/Req |`);
    lines.push('|--------|------------------|-------------------|-----------|-------|-----|-------------|-------|');
    for (const tco of state.tcoResultsExpanded.toSorted((a, b) => a.expanded.periodTotal - b.expanded.periodTotal)) {
      const name = methods.find((m) => m.id === tco.methodId)?.shortName ?? tco.methodId;
      lines.push(
        `| ${name} | ${formatCurrency(tco.expanded.upfront)} | ${formatCurrency(tco.expanded.monthlyRecurring)} | ${formatCurrency(tco.expanded.monthlyInference)} | ${formatCurrency(tco.expanded.monthlyInfrastructure)} | ${formatCurrency(tco.expanded.monthlyOperations)} | ${formatCurrency(tco.expanded.periodTotal)} | ${formatCostPerRequest(tco.costPerRequest)} |`,
      );
    }
  }

  // Insights
  if (state.insights.length > 0) {
    lines.push('\n## Insights\n');
    for (const insight of state.insights) {
      lines.push(`- ${insight}`);
    }
  }

  return lines.join('\n');
}

/**
 * Export TCO comparison as CSV.
 */
export function exportToCSV(state: ExportState): string {
  const h = state.timeHorizonMonths;
  const rows: string[] = [];
  rows.push(`Method,Setup (one-time),Monthly Recurring,Inference,Infrastructure,Operations,${h}-mo Total,Cost Per Request`);

  for (const tco of state.tcoResultsExpanded.toSorted((a, b) => a.expanded.periodTotal - b.expanded.periodTotal)) {
    const name = methods.find((m) => m.id === tco.methodId)?.shortName ?? tco.methodId;
    rows.push(
      `"${name}",${tco.expanded.upfront.toFixed(2)},${tco.expanded.monthlyRecurring.toFixed(2)},${tco.expanded.monthlyInference.toFixed(2)},${tco.expanded.monthlyInfrastructure.toFixed(2)},${tco.expanded.monthlyOperations.toFixed(2)},${tco.expanded.periodTotal.toFixed(2)},${tco.costPerRequest.toFixed(4)}`,
    );
  }

  return rows.join('\n');
}
