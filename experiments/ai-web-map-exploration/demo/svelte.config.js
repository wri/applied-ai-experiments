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
			fallback: 'index.html',
			precompress: false,
			strict: true
		}),
		paths: {
			base: isLocalDev ? `/${SLUG}` : `/applied-ai-experiments/${SLUG}`
		}
	}
};

export default config;
