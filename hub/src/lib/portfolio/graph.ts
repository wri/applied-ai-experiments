import type { PortfolioExperiment, Status } from './types';

/**
 * Slug-based graph traversal for experiment dependencies.
 * Adapted from the project-graph prototype; uses slugs instead of integer IDs.
 */

export function getAllDownstream(
  experiments: PortfolioExperiment[],
  slug: string,
  visited: Set<string> = new Set()
): Set<string> {
  for (const exp of experiments) {
    if (exp.depends_on.includes(slug) && !visited.has(exp.slug)) {
      visited.add(exp.slug);
      getAllDownstream(experiments, exp.slug, visited);
    }
  }
  return visited;
}

export function getAllUpstream(
  experiments: PortfolioExperiment[],
  slug: string,
  visited: Set<string> = new Set()
): Set<string> {
  const exp = experiments.find((e) => e.slug === slug);
  if (!exp) return visited;
  for (const dep of exp.depends_on) {
    if (!visited.has(dep)) {
      visited.add(dep);
      getAllUpstream(experiments, dep, visited);
    }
  }
  return visited;
}

export function getUnlockScores(experiments: PortfolioExperiment[]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const exp of experiments) {
    scores[exp.slug] = getAllDownstream(experiments, exp.slug).size;
  }
  return scores;
}

/**
 * An experiment is "ready" when all its dependencies are completed
 * and it hasn't been started yet. Useful for suggesting what to pick up next.
 */
export function isReady(
  exp: PortfolioExperiment,
  experiments: PortfolioExperiment[],
  statuses: Record<string, Status>
): boolean {
  const status = statuses[exp.slug] ?? exp.status;
  if (status === 'completed' || status === 'started' || status === 'archived') return false;
  if (exp.depends_on.length === 0) return true;
  return exp.depends_on.every((dep) => {
    const depStatus = statuses[dep] ?? experiments.find((e) => e.slug === dep)?.status;
    return depStatus === 'completed';
  });
}

export function getDirectUpstream(
  experiments: PortfolioExperiment[],
  slug: string
): PortfolioExperiment[] {
  const exp = experiments.find((e) => e.slug === slug);
  if (!exp) return [];
  return exp.depends_on
    .map((dep) => experiments.find((e) => e.slug === dep))
    .filter((e): e is PortfolioExperiment => e !== undefined);
}

export function getDirectDownstream(
  experiments: PortfolioExperiment[],
  slug: string
): PortfolioExperiment[] {
  return experiments.filter((e) => e.depends_on.includes(slug));
}
