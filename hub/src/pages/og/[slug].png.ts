/**
 * Per-experiment OG image. Prerendered at build to dist/og/{slug}.png
 * (served at /applied-ai-experiments/og/{slug}.png), referenced by both the
 * hub detail page and the demo's app.html.
 */
import type { APIRoute } from "astro";
import { loadExperimentIndex } from "../../utils/experiments";
import { experimentOg } from "../../utils/og";

export async function getStaticPaths() {
  const index = await loadExperimentIndex();
  return index.experiments.map((exp) => ({ params: { slug: exp.slug }, props: { exp } }));
}

export const GET: APIRoute = async ({ props }) => {
  const png = await experimentOg(props.exp as Parameters<typeof experimentOg>[0]);
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
