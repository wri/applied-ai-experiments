// Re-export types and utilities from shared-types
export {
  type Experiment,
  type ExperimentIndex,
  type ExperimentType,
  type ExperimentStatus,
  type DemoConfig,
  type ExperimentResults,
  getStatusColor,
  getTypeColor,
  getExperimentsByType,
  getExperimentsByTheme,
  getExperimentsByStatus,
} from "@wri/shared-types";

import type { ExperimentIndex } from "@wri/shared-types";

// Load the experiment index at build time (hub-specific utility)
export async function loadExperimentIndex(): Promise<ExperimentIndex> {
  const fs = await import("fs/promises");
  const path = await import("path");

  const indexPath = path.join(process.cwd(), "..", "experiment-index.json");
  const content = await fs.readFile(indexPath, "utf-8");
  return JSON.parse(content);
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
