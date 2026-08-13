import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Use LOCAL_DEV=true for local development (no base path)
const isLocalDev = process.env.LOCAL_DEV === 'true';
const origin = isLocalDev ? 'http://localhost:8080' : 'https://wri.github.io';
const base = isLocalDev ? '' : '/applied-ai-experiments';

// Demo SPAs are built separately (build-demos.sh) and copied into the same dist/,
// so the sitemap integration can't discover them from Astro routes. Add them as
// custom pages, derived from the experiment index. Keyed on demo.enabled (not the
// dist-existence-dependent _has_demo) so it's stable regardless of build order.
let demoPages = [];
try {
  const idxPath = fileURLToPath(new URL('../experiment-index.json', import.meta.url));
  const idx = JSON.parse(readFileSync(idxPath, 'utf-8'));
  demoPages = (idx.experiments ?? [])
    .filter((e) => e.demo && e.demo.enabled)
    .map((e) => `${origin}${base}/${e._is_notebook ? 'notebook/' : ''}${e.slug}/`);
} catch {
  // Index not generated yet — sitemap still covers all hub pages.
}

export default defineConfig({
  site: origin,
  base: isLocalDev ? '/' : '/applied-ai-experiments',
  outDir: '../dist',
  build: {
    assets: '_assets'
  },
  // Old top-level sections that were folded into Experiments/Learnings.
  // Destinations carry the base explicitly — static redirects emit the
  // destination string verbatim into a meta-refresh page.
  redirects: {
    '/demos': `${base}/experiments/?demos=true`,
    '/portfolio': `${base}/themes/`,
    '/insights': `${base}/learnings/`,
  },
  integrations: [
    sitemap({
      // Keep image endpoints out of the page sitemap.
      filter: (page) => !page.includes('/og/'),
      customPages: demoPages,
    }),
  ]
});
