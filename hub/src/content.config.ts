import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Curated insights: cross-experiment synthesis ("what have we learned about X?").
 *
 * Insights are authored as markdown files in the repo-root `insights/` directory
 * (versioned alongside the experiment portfolio). They are intentionally separate
 * from per-experiment `info.yaml` lessons and from the Python experiment-index
 * pipeline — an insight draws a thread across several experiments.
 *
 * Files whose names start with `_` (e.g. `_TEMPLATE.md`) are ignored by the loader.
 */
const insights = defineCollection({
  loader: glob({ pattern: '**/*.md', base: '../insights' }),
  schema: z.object({
    // Display title, e.g. "What we've learned about evals"
    title: z.string(),
    // One- or two-sentence standfirst shown in cards and at the top of the page
    summary: z.string(),
    // Theme keys this insight spans (must match taxonomy theme keys)
    themes: z.array(z.string()).default([]),
    // Slugs of experiments this insight synthesises; rendered as links
    related_experiments: z.array(z.string()).default([]),
    // Authoring/refresh date (used for ordering)
    date: z.coerce.date(),
    // Surface on the home page + top of insights index
    featured: z.boolean().default(false),
    // Only `published` insights appear in production; `draft` shows in dev only
    status: z.enum(['draft', 'published']).default('draft'),
    author: z.string().optional(),
  }),
});

export const collections = { insights };
