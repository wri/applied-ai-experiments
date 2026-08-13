// =============================================================================
// Hub links
// =============================================================================

/**
 * The hub homepage, derived from a demo's SvelteKit `base`.
 *
 * The hub and every demo are served from one origin, one directory apart: in
 * production the hub sits at `/applied-ai-experiments/` and a demo at
 * `/applied-ai-experiments/<slug>`; under `LOCAL_DEV=true` (the combined local
 * serve — see hub/astro.config.mjs) it is `/` and `/<slug>`. Both cases are the
 * same rule: drop the slug segment off the end of `base`.
 *
 * Pass `base` from `$app/paths` — this package stays free of SvelteKit imports,
 * so the caller supplies it.
 */
export function hubHomeHref(base: string): string {
  const parent = base.replace(/\/[^/]*\/?$/, '');
  return `${parent}/`;
}
