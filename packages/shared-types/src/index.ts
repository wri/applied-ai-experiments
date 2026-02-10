/**
 * Shared types for WRI experiments
 *
 * These types match the info.yaml schema and experiment-index.json structure.
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
  | "completed"
  | "archived";

// Demo configuration
export interface DemoConfig {
  enabled: boolean;
  type?: "sveltekit" | "static" | "notebook-html" | "marimo-html" | "marimo-wasm" | "astro";
  build_command?: string;
  output_dir?: string;
  path?: string;
}

// Experiment results
export interface ExperimentResults {
  summary?: string;
  lessons?: string[];
}

// Experiment metadata (matches info.yaml schema)
// Required fields: slug, title, type, status, description
// Recommended fields: owner, created_at
export interface Experiment {
  // Required fields
  slug: string;
  title: string;
  type: ExperimentType;
  status: ExperimentStatus;
  description: string;
  // Recommended fields (soft warnings if missing)
  owner?: string;
  created_at?: string;
  // Optional fields
  themes?: string[];
  tags?: string[];
  updated_at?: string;
  demo?: DemoConfig;
  runtime?: string;
  results?: ExperimentResults;
  // Links
  related_experiments?: string[];
  external_links?: { label: string; url: string }[];
  // Computed fields from index generation
  _has_demo?: boolean;
  _is_notebook?: boolean;
  _has_brief?: boolean;
}

// Experiment index structure (matches experiment-index.json)
export interface ExperimentIndex {
  generated_at: string;
  count: number;
  by_type: Record<ExperimentType, string[]>;
  by_theme: Record<string, string[]>;
  by_status: Record<ExperimentStatus, string[]>;
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
] as const;

export type Theme = (typeof VALID_THEMES)[number];

// Status badge colors - returns CSS variable references for Prototype design system
export function getStatusColor(status: ExperimentStatus | string): string {
  const colors: Record<string, string> = {
    idea: "var(--color-pu)",
    started: "var(--color-cy)",
    paused: "var(--color-ye)",
    completed: "var(--color-gr)",
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
