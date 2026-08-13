import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { VALID_THEMES } from '@wri/shared-types';

/**
 * Curated insights: cross-experiment synthesis ("what have we learned about X?").
 *
 * Insights are authored as markdown files in the repo-root `insights/` directory.
 * They are intentionally separate from per-experiment learnings (which live in each
 * brief's `## Learnings` section) and from the Python experiment-index pipeline —
 * an insight draws a thread across several experiments.
 *
 * NOTE: `insights/` is untracked today, so a CI checkout has no base directory and
 * this loader yields an empty collection with only a warning. `assertInsightsPresent`
 * in utils/experiments.ts turns that into a build failure.
 *
 * Files whose names start with `_` (e.g. `_TEMPLATE.md`) are excluded by the negative
 * glob below, so the template is never loaded or schema-checked. Without it the
 * template is a real entry: it only stayed off the site because it carries
 * `status: draft`, and its placeholder frontmatter had to satisfy the schema.
 */
const insights = defineCollection({
  loader: glob({ pattern: ['**/*.md', '!**/_*'], base: '../insights' }),
  schema: z.object({
    // Display title, e.g. "What we've learned about evals"
    title: z.string(),
    // One- or two-sentence standfirst shown in cards and at the top of the page.
    // Non-empty: an empty summary silently degrades the detail header, the Learnings
    // card, the RSS description, the meta description, and the OG card all at once.
    summary: z
      .string()
      .min(1, 'summary is required — it feeds the page, the cards, RSS, and the OG image'),
    // Theme keys this insight spans. Enum-checked against the canonical list —
    // an unrecognised key would otherwise ship a dead link to /themes/<typo>/.
    themes: z.array(z.enum(VALID_THEMES)).default([]),
    // Slugs of experiments this insight synthesises; rendered as links
    related_experiments: z.array(z.string()).default([]),
    // Authoring/refresh date (used for ordering)
    date: z.coerce.date(),
    // Surface on the home page + top of insights index
    featured: z.boolean().default(false),
    // Only `published` insights appear in production; `draft` shows in dev only
    status: z.enum(['draft', 'published']).default('draft'),
  }),
});

export const collections = { insights };
