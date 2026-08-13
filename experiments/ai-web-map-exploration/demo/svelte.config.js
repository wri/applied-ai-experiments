import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isLocalDev = process.env.LOCAL_DEV === 'true';

// The slug is always the experiment folder name (demo/'s parent) — derived, so it can't drift.
const SLUG = path.basename(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: 'dist',
			assets: 'dist',
			// Every route is prerendered (see src/routes/+layout.ts), so `/` gets a
			// real index.html and the fallback is only a net for URLs that don't
			// match a demo slug. Naming it 404.html rather than index.html keeps it
			// from overwriting that index, and lets a host that serves a directory's
			// 404.html hand an unknown slug to the app — which renders its own "no
			// demo named X" panel — instead of the host's error page.
			fallback: '404.html',
			precompress: false,
			strict: true
		}),
		paths: {
			base: isLocalDev ? `/${SLUG}` : `/applied-ai-experiments/${SLUG}`
		}
	}
};

export default config;
