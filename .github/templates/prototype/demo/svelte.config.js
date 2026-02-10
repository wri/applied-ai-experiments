import adapter from '@sveltejs/adapter-static';

const isLocalDev = process.env.LOCAL_DEV === 'true';

// IMPORTANT: Replace 'proto-CHANGEME' with your experiment slug
const SLUG = 'proto-CHANGEME';

/** @type {import('@sveltejs/kit').Config} */
const config = {
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
