/**
 * Default / fallback OG image for the hub home + section pages.
 * Prerendered to dist/og/default.png (/applied-ai-experiments/og/default.png).
 */
import type { APIRoute } from "astro";
import { defaultOg } from "../../utils/og";

export const GET: APIRoute = async () => {
  const png = await defaultOg();
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
