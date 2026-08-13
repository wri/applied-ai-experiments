/**
 * Shared types for WRI experiments
 *
 * These types match the brief.md frontmatter schema and experiment-index.json structure.
 *
 * The canonical schema lives in `.github/scripts/experiment_schema.py`. This
 * file necessarily duplicates its enums (TypeScript can't import Python), so
 * `just check-schema-sync` diffs the two and fails on drift. If you change an
 * enum here, change it there first.
 */

// Experiment type enum
export type ExperimentType =
  | "evaluation"
  | "benchmark"
  | "spike"
  | "prototype"
  | "research"
  | "notebook"
  | "marimo";

// Experiment status enum
export type ExperimentStatus =
  | "idea"
  | "started"
  | "paused"
  | "done"
  | "archived";

// Demo configuration
export interface DemoConfig {
  enabled: boolean;
  type?: "sveltekit" | "static" | "notebook-html" | "marimo-html" | "marimo-wasm" | "astro";
  build_command?: string;
  output_dir?: string;
}

// Experiment results
export interface ExperimentResults {
  summary?: string;
  learnings?: string[];
}

// What conceptual layer the work targets — orthogonal to `themes`, which says
// what domain it advances. See docs/experiments-process.md.
export type Targets = "capability" | "infra" | "feature";

// Experiment metadata (matches the brief.md frontmatter schema)
// Required fields: title, type, status, description
// Recommended fields: created_at, updated_at
export interface Experiment {
  // Always present in the index: defaulted from the directory name by
  // generate-index.py, and never authored in the frontmatter.
  slug: string;
  // Required fields
  title: string;
  type: ExperimentType;
  status: ExperimentStatus;
  description: string;
  // Recommended fields (soft warnings if missing)
  created_at?: string;
  updated_at?: string;
  // Optional fields
  themes?: string[];
  tags?: string[];
  targets?: Targets;
  demo?: DemoConfig;
  results?: ExperimentResults;
  // Computed fields from index generation
  /** There is a demo to link to. Keyed on demo.enabled, not on build output. */
  _has_demo?: boolean;
  /** The demo's build output exists on disk right now — local debugging only. */
  _demo_built?: boolean;
  _is_notebook?: boolean;
  _has_brief?: boolean;
  /**
   * Demonstrates the repo's own conventions (a worked file layout, a scaffolding
   * template) rather than asking a question about applied AI. Set from
   * `REFERENCE_SCAFFOLDS` in `.github/scripts/experiment_schema.py`. These stay
   * listed on /experiments/ with their own detail pages, but every surface that
   * aggregates across experiments filters them out — see `aggregatable()`.
   */
  _reference_scaffold?: boolean;
}

// Experiment index structure (matches experiment-index.json)
export interface ExperimentIndex {
  generated_at: string;
  count: number;
  by_type: Record<ExperimentType, string[]>;
  by_theme: Record<string, string[]>;
  by_status: Record<ExperimentStatus, string[]>;
  by_targets?: Record<Targets, string[]>;
  experiments: Experiment[];
}

// Valid theme values
export const VALID_THEMES = [
  "cost-perf",
  "evals",
  "patterns",
  "geospatial",
  "reliability",
  "agents",
  "scouting",
  "prototyping",
  "development",
] as const;

export type Theme = (typeof VALID_THEMES)[number];

// Valid targets values
export const VALID_TARGETS = ["capability", "infra", "feature"] as const;

// Status badge colors - returns CSS variable references for Prototype design system
export function getStatusColor(status: ExperimentStatus | string): string {
  const colors: Record<string, string> = {
    idea: "var(--color-pu)",
    started: "var(--color-cy)",
    paused: "var(--color-ye)",
    done: "var(--color-gr)",
    archived: "var(--color-tx-3)",
  };
  return colors[status] || "var(--color-tx-3)";
}

// Type badge colors - returns CSS variable references for Prototype design system
export function getTypeColor(type: ExperimentType | string): string {
  const colors: Record<string, string> = {
    prototype: "var(--color-pu)",
    evaluation: "var(--color-gr)",
    benchmark: "var(--color-or)",
    spike: "var(--color-re)",
    research: "var(--color-bl)",
    notebook: "var(--color-ma)",
    marimo: "var(--color-cy)",
  };
  return colors[type] || "var(--color-tx-3)";
}

// Filter experiments by type
export function getExperimentsByType(
  index: ExperimentIndex,
  type: ExperimentType | string
): Experiment[] {
  const slugs = index.by_type[type as ExperimentType] || [];
  return index.experiments.filter((e) => slugs.includes(e.slug));
}

// Filter experiments by theme
export function getExperimentsByTheme(
  index: ExperimentIndex,
  theme: string
): Experiment[] {
  const slugs = index.by_theme[theme] || [];
  return index.experiments.filter((e) => slugs.includes(e.slug));
}

// Filter experiments by status
export function getExperimentsByStatus(
  index: ExperimentIndex,
  status: ExperimentStatus | string
): Experiment[] {
  const slugs = index.by_status[status as ExperimentStatus] || [];
  return index.experiments.filter((e) => slugs.includes(e.slug));
}
