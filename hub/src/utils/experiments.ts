// Re-export types and utilities from shared-types
export {
  type Experiment,
  type ExperimentIndex,
  type ExperimentType,
  type ExperimentStatus,
  type DemoConfig,
  type ExperimentResults,
  type MediaConfig,
  type MediaRecording,
  getStatusColor,
  getTypeColor,
  getExperimentsByType,
  getExperimentsByTheme,
  getExperimentsByStatus,
} from "@wri/shared-types";

import type {
  Experiment,
  ExperimentIndex,
  ExperimentType,
  ExperimentStatus,
  MediaRecording,
} from "@wri/shared-types";
import taxonomy from "../data/taxonomy.json";

// Load the experiment index at build time (hub-specific utility)
export async function loadExperimentIndex(): Promise<ExperimentIndex> {
  const fs = await import("fs/promises");
  const path = await import("path");

  const indexPath = path.join(process.cwd(), "..", "experiment-index.json");
  const content = await fs.readFile(indexPath, "utf-8");
  return JSON.parse(content);
}

// --- Media helpers ----------------------------------------------------------

/** Resolve a recording's type: explicit `type` wins, else inferred from hostname. */
export function recordingType(rec: MediaRecording): "video" | "youtube" | "loom" {
  if (rec.type) return rec.type;
  try {
    const host = new URL(rec.src).hostname;
    if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host)) return "youtube";
    if (/(^|\.)loom\.com$/.test(host)) return "loom";
  } catch {
    // malformed URLs fall through to a plain <video> element
  }
  return "video";
}

/** Embed URL for youtube/loom recordings (handles watch?v= and youtu.be forms). */
export function embedUrl(rec: MediaRecording): string {
  const kind = recordingType(rec);
  try {
    const url = new URL(rec.src);
    if (kind === "youtube") {
      const id = url.hostname.endsWith("youtu.be")
        ? url.pathname.slice(1)
        : url.searchParams.get("v") ?? url.pathname.split("/").pop() ?? "";
      return `https://www.youtube-nocookie.com/embed/${id}`;
    }
    if (kind === "loom") {
      const id = url.pathname.split("/").pop() ?? "";
      return `https://www.loom.com/embed/${id}`;
    }
  } catch {
    // fall through
  }
  return rec.src;
}

// --- Taxonomy helpers -------------------------------------------------------

export interface ThemeConfig {
  name: string;
  short: string;
  color: string;
}

/** Resolve a theme key to its taxonomy config (name/short/color), or null. */
export function getThemeConfig(themeKey: string): ThemeConfig | null {
  return (taxonomy.themes as Record<string, ThemeConfig>)[themeKey] ?? null;
}

// --- Lesson aggregation -----------------------------------------------------
// One source of truth for "lessons harvested from completed experiments",
// shared by the home page, learnings page, and theme pages.

export interface LessonEntry {
  lesson: string;
  slug: string;
  title: string;
  type: ExperimentType;
  status: ExperimentStatus;
  themes: string[];
  updatedAt?: string;
  /** Position in the experiment's results.lessons — anchors as #lesson-{n} on the detail page. */
  lessonIndex: number;
}

export interface CollectedLessons {
  /** Flat list of every lesson, sorted by experiment recency (newest first). */
  entries: LessonEntry[];
  /** Lessons grouped by theme key (a multi-theme experiment appears under each). */
  byTheme: Map<string, LessonEntry[]>;
  /** Lessons from experiments that carry no theme. */
  untagged: LessonEntry[];
  /** Theme keys ordered by pillar, then by lesson count within a pillar. */
  orderedThemes: string[];
  /** Total lesson count across all completed experiments. */
  total: number;
  /** Completed experiments that have at least one lesson, newest first. */
  completed: Experiment[];
}

function recency(e: { updated_at?: string; created_at?: string }): number {
  return new Date(e.updated_at || e.created_at || 0).getTime();
}

export function collectLessons(index: ExperimentIndex): CollectedLessons {
  const completed = index.experiments
    .filter((e) => e.status === "completed" && e.results?.lessons?.length)
    .sort((a, b) => recency(b) - recency(a));

  const entries: LessonEntry[] = [];
  const byTheme = new Map<string, LessonEntry[]>();
  const untagged: LessonEntry[] = [];

  for (const exp of completed) {
    for (const [lessonIndex, lesson] of exp.results!.lessons!.entries()) {
      const entry: LessonEntry = {
        lesson,
        slug: exp.slug,
        title: exp.title,
        type: exp.type,
        status: exp.status,
        themes: exp.themes ?? [],
        updatedAt: exp.updated_at,
        lessonIndex,
      };
      entries.push(entry);
      if (!exp.themes || exp.themes.length === 0) {
        untagged.push(entry);
      } else {
        for (const themeKey of exp.themes) {
          if (!byTheme.has(themeKey)) byTheme.set(themeKey, []);
          byTheme.get(themeKey)!.push(entry);
        }
      }
    }
  }

  const orderedThemes: string[] = [];
  for (const pillar of taxonomy.pillars) {
    const pillarThemes = pillar.themes
      .filter((t) => byTheme.has(t))
      .sort((a, b) => (byTheme.get(b)?.length ?? 0) - (byTheme.get(a)?.length ?? 0));
    orderedThemes.push(...pillarThemes);
  }

  const total = completed.reduce((sum, e) => sum + (e.results?.lessons?.length ?? 0), 0);

  return { entries, byTheme, untagged, orderedThemes, total, completed };
}

/**
 * One representative (first) lesson per completed experiment, newest first.
 * Used for the home-page "Latest learnings" strip so it stays diverse rather
 * than being dominated by a single experiment's bullet list.
 */
export function lessonHighlights(index: ExperimentIndex, limit = 4): LessonEntry[] {
  const { completed } = collectLessons(index);
  return completed.slice(0, limit).map((exp) => ({
    lesson: exp.results!.lessons![0],
    slug: exp.slug,
    title: exp.title,
    type: exp.type,
    status: exp.status,
    themes: exp.themes ?? [],
    updatedAt: exp.updated_at,
    lessonIndex: 0,
  }));
}

// --- Insights (curated cross-experiment synthesis) --------------------------

/**
 * Filter + sort insight collection entries for display. Drafts are shown only
 * in dev so authors can preview them; published insights are sorted newest first.
 * Generic over the astro:content entry shape to avoid a hard dependency here.
 */
export function visibleInsights<
  T extends { data: { status: string; date: Date } },
>(entries: T[], dev = false): T[] {
  return entries
    .filter((e) => dev || e.data.status === "published")
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

/**
 * Transform raw brief.md content for hub rendering.
 *
 * Strips authoring-oriented structure that doesn't belong on the hub:
 * 1. Leading H1 (page already renders experiment.title from info.yaml)
 * 2. "## Before" heading (sub-headings are self-explanatory)
 * 3. HTML-comment-wrapped After section (geo-metadata-bakeoff style)
 * 4. Empty "## After" section (only headings + placeholder text) → remove entirely
 * 5. Filled "## After" section → keep content, remove heading
 */
export function transformBriefMarkdown(md: string): string {
  let result = md;

  // 1. Remove the first H1 line
  result = result.replace(/^# .+\n+/, "");

  // 2. Remove "## Before" heading (keep content after it)
  result = result.replace(/^## Before\n+/m, "");

  // 3a. Remove HTML-comment-wrapped After section
  result = result.replace(/\n*<!--[\s\S]*?## After[\s\S]*?-->\s*$/, "");

  // 3b. Check if unwrapped After section is empty → strip entirely
  //     If it has real content → strip only the "## After" heading
  const afterMatch = result.match(/(\n*---\n+)(## After\n+)([\s\S]*)$/);
  if (afterMatch) {
    const afterBody = afterMatch[3];
    const stripped = afterBody
      .replace(/^###.*$/gm, "")
      .replace(/^_.*_\s*$/gm, "")
      .replace(/^\s*$/gm, "")
      .trim();

    if (stripped.length === 0) {
      // Empty After section → remove entirely (including ---)
      result = result.replace(/\n*---\n+## After\n[\s\S]*$/, "");
    } else {
      // Filled After section → remove only the "## After" heading
      result = result.replace(/^## After\n+/m, "");
    }
  }

  return result.trim();
}

/**
 * Split a brief.md into before and after markdown, preserving the "After" section
 * when it has real content. Used by the experiment detail page to render the
 * outcome section distinctly from the scoping narrative.
 *
 * Returns `after: null` when the After section is empty or an authoring placeholder.
 */
export function splitBriefMarkdown(md: string): { before: string; after: string | null } {
  // Strip leading H1 + leading "## Before" heading from the full document
  let working = md.replace(/^# .+\n+/, "").replace(/^## Before\n+/m, "");

  // Strip HTML-comment-wrapped After section — authoring-only, never show
  working = working.replace(/\n*<!--[\s\S]*?## After[\s\S]*?-->\s*$/, "");

  // Try to isolate the After section
  const afterMatch = working.match(/(\n*---\n+)(## After\n+)([\s\S]*)$/);
  if (!afterMatch) {
    return { before: working.trim(), after: null };
  }

  const beforeEnd = afterMatch.index ?? working.length;
  const before = working.slice(0, beforeEnd).replace(/\n*---\s*$/, "").trim();

  const afterBody = afterMatch[3];
  // Check if After is just placeholder text
  const stripped = afterBody
    .replace(/^###.*$/gm, "")
    .replace(/^_.*_\s*$/gm, "")
    .replace(/^\s*$/gm, "")
    .trim();

  if (stripped.length === 0) {
    return { before, after: null };
  }

  return { before, after: afterBody.trim() };
}

// Load brief.md content for an experiment at build time
export async function loadBriefContent(slug: string): Promise<string | null> {
  const fs = await import("fs/promises");
  const path = await import("path");

  const briefPath = path.join(process.cwd(), "..", "experiments", slug, "brief.md");
  try {
    return await fs.readFile(briefPath, "utf-8");
  } catch {
    return null;
  }
}
