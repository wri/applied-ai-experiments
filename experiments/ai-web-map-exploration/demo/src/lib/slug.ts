import { base } from '$app/paths';

/**
 * The experiment slug, derived from the SvelteKit base path so it can never
 * drift from the folder name (the same principle svelte.config.js uses).
 *
 * `base` is `/applied-ai-experiments/<slug>` in production and `/<slug>` in
 * local dev — the last non-empty path segment is the slug either way. Used to
 * namespace BYOK key storage and session telemetry.
 */
export const SLUG = base.split('/').filter(Boolean).pop() ?? 'ai-web-map-exploration';
