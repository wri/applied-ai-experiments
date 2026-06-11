import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { loadExperimentIndex, visibleInsights } from '../utils/experiments';

const SITE = 'https://wri.github.io';

export async function GET(context: APIContext) {
  const index = await loadExperimentIndex();
  const rawBase = import.meta.env.BASE_URL;
  const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

  const completed = index.experiments
    .filter((e) => e.status === 'completed')
    .map((e) => ({
      title: `Completed: ${e.title}`,
      description: [e.description, e.results?.summary].filter(Boolean).join(' — '),
      link: `${base}experiments/${e.slug}/`,
      pubDate: new Date(e.updated_at || e.created_at || 0),
    }));

  const allInsights = await getCollection('insights');
  const insights = visibleInsights(allInsights, false).map((i) => ({
    title: `Insight: ${i.data.title}`,
    description: i.data.summary,
    link: `${base}insights/${i.id}/`,
    pubDate: i.data.date,
  }));

  const items = [...completed, ...insights].sort(
    (a, b) => b.pubDate.getTime() - a.pubDate.getTime()
  );

  return rss({
    title: 'WRI Applied AI Experiments',
    description:
      'Completed experiments and cross-experiment insights from the WRI Applied AI Group.',
    site: context.site ?? SITE,
    items,
  });
}
