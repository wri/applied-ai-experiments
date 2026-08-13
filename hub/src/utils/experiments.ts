// Re-export types and utilities from shared-types
export {
  type Experiment,
  type ExperimentIndex,
  type ExperimentType,
  type ExperimentStatus,
  type DemoConfig,
  type ExperimentResults,
  type Targets,
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
} from "@wri/shared-types";
import taxonomy from "../data/taxonomy.json";
import { marked } from "marked";

// Load the experiment index at build time (hub-specific utility)
export async function loadExperimentIndex(): Promise<ExperimentIndex> {
  const fs = await import("fs/promises");
  const path = await import("path");

  const indexPath = path.join(process.cwd(), "..", "experiment-index.json");
  try {
    return JSON.parse(await fs.readFile(indexPath, "utf-8"));
  } catch (err) {
    // The index is generated and gitignored, so a fresh clone hits this before it
    // hits anything else. A bare ENOENT gives no hint about which command to run.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `experiment-index.json not found at ${indexPath}.\n` +
          "  It's generated from the experiment briefs and gitignored, so a fresh\n" +
          "  clone has to build it: run `just generate-index` (or `just dev-hub`,\n" +
          "  which now does it for you).",
      );
    }
    throw err;
  }
}

// --- Aggregation scope ------------------------------------------------------

/**
 * The experiments that count when the hub speaks for the portfolio as a whole.
 *
 * Reference scaffolds — the worked file-layout example, the scaffolding
 * template spike, the one-command `uv` demonstrator — are real directories with
 * real briefs, and they keep their place on /experiments/ and their own detail
 * pages. What they don't do is speak for the portfolio: their content is about
 * how this repository works, so counting them in a theme's tally or feeding
 * their results into the Learnings page, the home page, or the RSS feed dilutes
 * the signal for a reader who came to find out what we learned about AI.
 *
 * Use this in every surface that aggregates, counts, ranks, or syndicates across
 * experiments. Do NOT use it for the experiments list, an experiment's own
 * detail page, its OG card, or the sitemap — those present one experiment as
 * itself, which is exactly where a scaffold belongs.
 */
export function aggregatable<T extends { _reference_scaffold?: boolean }>(
  experiments: T[],
): T[] {
  return experiments.filter((e) => !e._reference_scaffold);
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

/** Display name for an experiment type — marimo experiments present as "notebook". */
export function displayType(type: string): string {
  return type === "marimo" ? "notebook" : type;
}

// --- Learning aggregation -----------------------------------------------------
// One source of truth for "learnings harvested from experiments", shared by the
// home page, learnings page, and theme pages. Learnings surface at any status —
// in-flight experiments may publish learnings before completion.

export interface LearningEntry {
  learning: string;
  slug: string;
  title: string;
  type: ExperimentType;
  status: ExperimentStatus;
  themes: string[];
  updatedAt?: string;
  /** Position in the experiment's results.learnings — anchors as #learning-{n} on the detail page. */
  learningIndex: number;
}

export interface CollectedLearnings {
  /** Flat list of every learning, sorted by experiment recency (newest first). */
  entries: LearningEntry[];
  /** Learnings grouped by theme key (a multi-theme experiment appears under each). */
  byTheme: Map<string, LearningEntry[]>;
  /**
   * Learnings grouped by *primary* theme only — the first entry in the
   * experiment's `themes:`, per the content guide. Every learning appears
   * exactly once, so these counts sum to `total`. Use this wherever learnings
   * are listed (the Learnings page); use `byTheme` for "does this theme touch
   * this learning" membership questions (theme pages, counts).
   */
  byPrimaryTheme: Map<string, LearningEntry[]>;
  /** Learnings from experiments that carry no theme. */
  untagged: LearningEntry[];
  /** Theme keys ordered by pillar, then by learning count within a pillar. */
  orderedThemes: string[];
  /** Total learning count across all experiments. */
  total: number;
  /** Experiments (any status) that have at least one learning, newest first. */
  sources: Experiment[];
}

function recency(e: { updated_at?: string; created_at?: string }): number {
  return new Date(e.updated_at || e.created_at || 0).getTime();
}

export function collectLearnings(index: ExperimentIndex): CollectedLearnings {
  // Reference scaffolds are excluded at the source, so every consumer of this
  // function — the Learnings page, the home page, the theme cards — inherits the
  // right scope without having to remember.
  const sources = aggregatable(index.experiments)
    .filter((e) => e.results?.learnings?.length)
    .sort((a, b) => recency(b) - recency(a));

  const entries: LearningEntry[] = [];
  const byTheme = new Map<string, LearningEntry[]>();
  const byPrimaryTheme = new Map<string, LearningEntry[]>();
  const untagged: LearningEntry[] = [];

  for (const exp of sources) {
    for (const [learningIndex, learning] of exp.results!.learnings!.entries()) {
      const entry: LearningEntry = {
        learning,
        slug: exp.slug,
        title: exp.title,
        type: exp.type,
        status: exp.status,
        themes: exp.themes ?? [],
        updatedAt: exp.updated_at,
        learningIndex,
      };
      entries.push(entry);
      if (!exp.themes || exp.themes.length === 0) {
        untagged.push(entry);
      } else {
        for (const themeKey of exp.themes) {
          if (!byTheme.has(themeKey)) byTheme.set(themeKey, []);
          byTheme.get(themeKey)!.push(entry);
        }
        const primary = exp.themes[0];
        if (!byPrimaryTheme.has(primary)) byPrimaryTheme.set(primary, []);
        byPrimaryTheme.get(primary)!.push(entry);
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

  const total = sources.reduce((sum, e) => sum + (e.results?.learnings?.length ?? 0), 0);

  return {
    entries,
    byTheme,
    byPrimaryTheme,
    untagged,
    orderedThemes,
    total,
    sources,
  };
}

/**
 * One representative (first) learning per experiment with learnings, newest first.
 * Used for the home-page "Latest learnings" strip so it stays diverse rather
 * than being dominated by a single experiment's bullet list.
 */
export function learningHighlights(index: ExperimentIndex, limit = 4): LearningEntry[] {
  const { sources } = collectLearnings(index);
  return sources.slice(0, limit).map((exp) => ({
    learning: exp.results!.learnings![0],
    slug: exp.slug,
    title: exp.title,
    type: exp.type,
    status: exp.status,
    themes: exp.themes ?? [],
    updatedAt: exp.updated_at,
    learningIndex: 0,
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
 * Fail a production build that would ship an empty insights layer.
 *
 * The insights collection loads from the repo-root `insights/` directory, which is
 * untracked — so a CI checkout has no such directory, and Astro's glob loader
 * responds to a missing base dir with a *warning* and an empty collection. The
 * build then goes green while the home page, this page, the RSS feed, and every
 * /insights/<slug> route quietly lose their content. Silent degradation of the
 * published site is worse than a failed build, so this makes it loud.
 *
 * Set ALLOW_EMPTY_INSIGHTS=1 for a deliberate insight-free build.
 */
export function assertInsightsPresent(count: number): void {
  if (count > 0) return;
  if (!import.meta.env.PROD) return;
  if (process.env.ALLOW_EMPTY_INSIGHTS) {
    console.warn("[hub] Building with zero insights (ALLOW_EMPTY_INSIGHTS is set).");
    return;
  }
  throw new Error(
    "No published insights found, so this build would ship an empty insights layer.\n" +
      "  Most likely cause: the repo-root `insights/` directory is not in this checkout\n" +
      "  (it is untracked, so CI never sees it). Astro's glob loader only warns about a\n" +
      "  missing base directory, which is why the build otherwise looks fine.\n" +
      "  Fix: track `insights/`, or set ALLOW_EMPTY_INSIGHTS=1 if empty is intended.",
  );
}

// --- Brief "After" section: template detection ------------------------------
// The templates ship the After section pre-filled with prompt prose under every
// `###` heading. Stripping headings and `_italics_` alone leaves that prose
// behind, so an untouched After section looked like real content and rendered as
// an "Outcome" on the detail page. Match the prompts themselves.
//
// Compared as normalized prefixes rather than exact strings so small wording
// drifts between template generations still register as unfilled (for example
// example-experiment's "These learnings can be more valuable…" vs. the template's
// "These are often more valuable…").
const TEMPLATE_AFTER_PROMPTS = [
  "fill this section out when the experiment concludes",
  "answer each signal from",
  "what did you actually do",
  "the 2-5 findings someone should take away",
  "should we adopt this, keep exploring, stop, share it, build on it",
  "non-obvious choices you made during the work",
  "brief summary of findings",
  "tbd",
  "todo",
];

/** Lowercase, collapse whitespace, and flatten markdown emphasis + dash variants. */
function normalizeProse(line: string): string {
  return line
    .replace(/[*_`]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * True when an After-section body carries no author-written content — only
 * headings, horizontal rules, and untouched template prompt prose.
 */
export function isTemplateAfterSection(afterBody: string): boolean {
  const substantive = afterBody
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    // Headings and rules carry no content of their own.
    .filter((line) => !/^#{1,6}\s/.test(line) && !/^([-*_]\s*){3,}$/.test(line))
    .map(normalizeProse)
    .filter((line) => line.length > 0)
    .filter(
      (line) => !TEMPLATE_AFTER_PROMPTS.some((prompt) => line.startsWith(prompt)),
    );

  return substantive.length === 0;
}

/**
 * Transform raw brief.md content for hub rendering.
 *
 * Strips authoring-oriented structure that doesn't belong on the hub:
 * 1. Leading H1 (the page already renders experiment.title from the frontmatter)
 * 2. "## Before" heading (sub-headings are self-explanatory)
 * 3. HTML-comment-wrapped After section (geo-metadata-bakeoff style)
 * 4. Empty "## After" section (only headings + placeholder text) → remove entirely
 * 5. Filled "## After" section → keep content, remove heading
 * 6. Individual empty subsections of a partly-filled After → dropped, or rendered
 *    as an explicit "pending" note when the author said what they're waiting on
 */
export function transformBriefMarkdown(md: string): string {
  let result = md;

  // 1. Remove the first H1 line
  result = result.replace(/^# .+\n+/, "");

  // 2. Remove "## Before" heading (keep content after it)
  result = result.replace(/^## Before\n+/m, "");

  // 2b. Drop the lede blockquote — it is `description`, rendered in the header
  result = stripLedeBlockquote(result);

  // 2c. Drop "## Learnings" — rendered from results.learnings, not from the prose
  result = stripLearningsSection(result);

  // 3a. Remove HTML-comment-wrapped After section
  result = result.replace(/\n*<!--[\s\S]*?## After[\s\S]*?-->\s*$/, "");

  // 3b. Check if unwrapped After section is empty → strip entirely
  //     If it has real content → strip only the "## After" heading
  const afterMatch = result.match(/(\n*(?:---\n+)?)(## After\n+)([\s\S]*)$/m);
  if (afterMatch) {
    if (isTemplateAfterSection(stripOutcomeLine(afterMatch[3]))) {
      // Empty or untouched-template After section → remove entirely (including ---)
      result = result.replace(/\n*(?:---\n+)?## After\n[\s\S]*$/m, "");
    } else {
      // Filled After section → remove only the "## After" heading
      result = result.replace(/^## After\n+/m, "");
      // …and resolve the subsections nobody has been able to answer yet.
      result = resolvePendingSubsections(result);
    }
  }

  return result.trim();
}

/** A `_Pending: what we're waiting on_` line, the optional marker in an empty subsection. */
const PENDING_LINE = /^\s*_+\s*Pending\s*:?\s*(.*?)\s*_+\s*$/i;

/**
 * Resolve the `###` subsections of a partly-filled After section.
 *
 * A close-out is often partial on purpose: the build is finished and the learnings
 * are published, but a signal can't be answered until colleagues finish testing or
 * a queued eval runs. Rendering those as bare headings with nothing underneath made
 * the page read as abandoned — three empty promises in a row — which is the opposite
 * of what a partial close-out actually means.
 *
 * So: an empty subsection is dropped, and one carrying a `_Pending: …_` marker keeps
 * its heading and renders the reason as an explicit pending note. Saying what you're
 * waiting on is what earns the space on the page.
 */
function resolvePendingSubsections(afterMd: string): string {
  // Split on `###` headings, keeping the heading text as a capture group.
  const parts = afterMd.split(/^###[ \t]+(.+?)[ \t]*$/m);
  if (parts.length < 3) return afterMd;

  let out = parts[0];
  for (let i = 1; i < parts.length - 1; i += 2) {
    const heading = parts[i];
    const content = parts[i + 1] ?? "";

    let reason: string | null = null;
    const kept: string[] = [];
    for (const line of content.split("\n")) {
      const m = line.match(PENDING_LINE);
      if (m) {
        reason = (m[1] ?? "").trim() || null;
      } else {
        kept.push(line);
      }
    }

    if (kept.join("\n").trim().length > 0) {
      out += `### ${heading}\n${content}`;
      continue;
    }
    if (reason) {
      // Raw HTML passes through marked untouched, which keeps the styling in the
      // page's stylesheet rather than smuggling it into the markdown.
      out += `### ${heading}\n\n<p class="pending-note"><span class="pending-label">Pending</span>${escapeHtml(
        reason,
      )}</p>\n\n`;
    }
    // Unmarked and empty → the whole subsection is omitted.
  }
  return out;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Remove the lede blockquote that opens the brief.
 *
 * It is the source for `description`, which the detail page already renders in
 * its header (and which feeds the card, OG image, and RSS). Leaving it in the
 * body would print the same sentences twice, a few lines apart.
 *
 * Runs after the H1 has been stripped, so the blockquote is at the start.
 */
function stripLedeBlockquote(md: string): string {
  return md.replace(/^(?:>[^\n]*\n)+\s*/, "");
}

/**
 * Remove the brief's "## Learnings" section.
 *
 * Learnings are authored there and generated into `results.learnings`, which this
 * page already renders as the "Learnings" grid. Leaving the source section
 * in the prose body would print every learning twice on the same page.
 */
function stripLearningsSection(md: string): string {
  return (
    md
      // Followed by another section — stop at its heading.
      .replace(/^## Learnings[ \t]*\n[\s\S]*?(?=^## )/m, "")
      // Last section in the file — run to the end. Needed as a separate pass
      // because JS regex has no \Z, and /$/m would match the first line end.
      .replace(/^## Learnings[ \t]*\n[\s\S]*$/m, "")
      // The rule that used to separate Learnings from what followed.
      .replace(/\n---\s*\n\s*(?=## )/g, "\n\n")
      // ...or, when Learnings was last, the rule now dangling at the end.
      .replace(/\n+---\s*$/, "")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd()
  );
}

/**
 * Remove the `**Outcome:**` line that opens the After section.
 *
 * It is the source for `results.summary`, which the detail page already renders
 * in its own "Outcome at a glance" callout above the brief. Leaving it in the
 * body would print the same sentence twice, a few hundred pixels apart.
 *
 * The line may be wrapped across several source lines, so this runs to the next
 * blank line rather than the next newline.
 */
function stripOutcomeLine(md: string): string {
  return (
    md
      // Followed by more of the After section — stop at the blank line.
      .replace(/^\*\*Outcome:\*\*[\s\S]*?(?=\n[ \t]*\n)/m, "")
      // Nothing after it — run to the end. A separate greedy pass because under
      // the `m` flag `$` means end-of-line, so a lazy match would stop at the
      // first wrapped line and leave the rest of the sentence behind.
      .replace(/^\*\*Outcome:\*\*[\s\S]*$/m, "")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\n+/, "")
  );
}

/**
 * Render one learning's inline markdown to HTML.
 *
 * Learnings are authored as markdown bullets in brief.md, so they carry the bold
 * lede and inline code that make them scannable. Interpolating the raw string
 * would print the asterisks and backticks literally.
 *
 * `parseInline` deliberately, not `parse`: a learning is a fragment that sits
 * inside a card, so it must not be wrapped in a block-level <p>.
 */
export function renderLearningInline(learning: string): string {
  return marked.parseInline(learning) as string;
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

  // The lede is `description`, rendered in the page header — drop it here.
  working = stripLedeBlockquote(working);

  // Learnings render from results.learnings, not from the prose — drop the source section
  working = stripLearningsSection(working);

  // Strip HTML-comment-wrapped After section — authoring-only, never show
  working = working.replace(/\n*<!--[\s\S]*?## After[\s\S]*?-->\s*$/, "");

  // Try to isolate the After section
  const afterMatch = working.match(/(\n*(?:---\n+)?)(## After\n+)([\s\S]*)$/m);
  if (!afterMatch) {
    return { before: working.trim(), after: null };
  }

  const beforeEnd = afterMatch.index ?? working.length;
  const before = working.slice(0, beforeEnd).replace(/\n*---\s*$/, "").trim();

  // The Outcome line is the source for results.summary, rendered separately.
  const afterBody = stripOutcomeLine(afterMatch[3]);
  if (isTemplateAfterSection(afterBody)) {
    return { before, after: null };
  }

  // Drop the subsections nobody can answer yet (or render their stated reason) —
  // otherwise a partial close-out shows as a run of empty headings.
  const resolved = resolvePendingSubsections(afterBody).trim();
  return { before, after: resolved.length > 0 ? resolved : null };
}

/**
 * Strip the YAML frontmatter block from a brief.
 *
 * Metadata reaches the hub through experiment-index.json; the markdown body is
 * the only part that renders. Left in place, the block would not merely show —
 * its closing `---` turns the whole thing into a setext H2, making it the
 * largest heading on the page.
 *
 * Line-anchored and non-greedy, because brief bodies use `---` as a horizontal
 * rule between Before / Learnings / After. This mirrors `split()` in
 * .github/scripts/experiment_doc.py; keep the two in step.
 */
function stripFrontmatter(raw: string): string {
  const text = raw.replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return raw;
  const lines = text.split("\n");
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "---" || line === "...") {
      return lines.slice(i + 1).join("\n").replace(/^\n+/, "");
    }
  }
  // Unterminated block — render as-is rather than guessing where metadata ends.
  return raw;
}

// Load brief.md content for an experiment at build time
export async function loadBriefContent(slug: string): Promise<string | null> {
  const fs = await import("fs/promises");
  const path = await import("path");

  const briefPath = path.join(process.cwd(), "..", "experiments", slug, "brief.md");
  try {
    return stripFrontmatter(await fs.readFile(briefPath, "utf-8"));
  } catch {
    return null;
  }
}
