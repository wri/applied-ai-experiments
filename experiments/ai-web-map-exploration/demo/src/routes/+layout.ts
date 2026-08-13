// Client-side SPA: BYOK keys, localStorage, and MapLibre are all browser-only.
export const ssr = false;

// Prerender anyway. With `ssr = false` this emits an HTML shell per route rather
// than rendered markup — no server rendering happens, so the browser-only code
// above stays browser-only. What it buys is a real file at every URL.
//
// Without it the only file in dist/ is the SPA fallback, so a static host has
// nothing to serve for /<slug> and answers 404: the app works when you navigate
// to a demo in-app, but the resulting URL can't be shared or reloaded. GitHub
// Pages has no rewrite rules to paper over that, so the files have to exist.
// The dynamic route enumerates its own entries — see [demo]/+page.ts.
export const prerender = true;
