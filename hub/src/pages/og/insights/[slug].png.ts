/**
 * Per-insight OG image. Prerendered at build to dist/og/insights/{slug}.png
 * (served at /applied-ai-experiments/og/insights/{slug}.png), referenced by
 * the insight detail page. Drafts get cards too (they only render in dev).
 */
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { visibleInsights } from "../../../utils/experiments";
import { insightOg } from "../../../utils/og";

export async function getStaticPaths() {
  const all = await getCollection("insights");
  const insights = visibleInsights(all, import.meta.env.DEV);
  return insights.map((insight) => ({ params: { slug: insight.id }, props: { insight } }));
}

export const GET: APIRoute = async ({ props }) => {
  const { insight } = props as { insight: { id: string; data: { title: string; summary?: string } } };
  const png = await insightOg({
    title: insight.data.title,
    summary: insight.data.summary,
    slug: insight.id,
  });
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
