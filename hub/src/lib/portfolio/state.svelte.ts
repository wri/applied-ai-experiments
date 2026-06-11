import type { PortfolioExperiment, Status, Taxonomy } from './types';
import { getAllUpstream, getAllDownstream } from './graph';

type View = 'ladder' | 'ranking';

interface PortfolioState {
  view: View;
  experiments: PortfolioExperiment[];
  taxonomy: Taxonomy;
  selectedSlug: string | null;
  tracedSlug: string | null;   // when set, highlights upstream + downstream of this slug
  themeFilter: string | null;  // theme key to filter by, or null for all
  statusOverrides: Record<string, Status>;
}

const STORAGE_KEY = 'portfolio-status-overrides';

function loadOverrides(): Record<string, Status> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOverrides(overrides: Record<string, Status>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* ignore */
  }
}

export function createPortfolioState(
  experiments: PortfolioExperiment[],
  taxonomy: Taxonomy
) {
  const state = $state<PortfolioState>({
    view: 'ladder',
    experiments,
    taxonomy,
    selectedSlug: null,
    tracedSlug: null,
    themeFilter: null,
    statusOverrides: loadOverrides()
  });

  const effectiveStatus = (slug: string): Status => {
    const override = state.statusOverrides[slug];
    if (override) return override;
    return state.experiments.find((e) => e.slug === slug)?.status ?? 'idea';
  };

  const tracedUpstream = $derived(
    state.tracedSlug
      ? getAllUpstream(state.experiments, state.tracedSlug)
      : new Set<string>()
  );
  const tracedDownstream = $derived(
    state.tracedSlug
      ? getAllDownstream(state.experiments, state.tracedSlug)
      : new Set<string>()
  );

  const filteredExperiments = $derived(
    state.themeFilter
      ? state.experiments.filter((e) => e.themes.includes(state.themeFilter!))
      : state.experiments
  );

  const cycleStatus = (slug: string): void => {
    const cycle: Status[] = ['idea', 'started', 'completed', 'paused'];
    const current = effectiveStatus(slug);
    const idx = cycle.indexOf(current);
    const next = cycle[(idx + 1) % cycle.length];
    state.statusOverrides = { ...state.statusOverrides, [slug]: next };
    saveOverrides(state.statusOverrides);
  };

  const clearOverrides = (): void => {
    state.statusOverrides = {};
    saveOverrides({});
  };

  return {
    get view() { return state.view; },
    set view(v: View) { state.view = v; },
    get experiments() { return state.experiments; },
    get filteredExperiments() { return filteredExperiments; },
    get taxonomy() { return state.taxonomy; },
    get selectedSlug() { return state.selectedSlug; },
    set selectedSlug(s: string | null) { state.selectedSlug = s; },
    get tracedSlug() { return state.tracedSlug; },
    set tracedSlug(s: string | null) { state.tracedSlug = s; },
    get themeFilter() { return state.themeFilter; },
    set themeFilter(t: string | null) { state.themeFilter = t; },
    get tracedUpstream() { return tracedUpstream; },
    get tracedDownstream() { return tracedDownstream; },
    effectiveStatus,
    cycleStatus,
    clearOverrides
  };
}

export type PortfolioStateAPI = ReturnType<typeof createPortfolioState>;
