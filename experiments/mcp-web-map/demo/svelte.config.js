import adapter from '@sveltejs/adapter-static';

const isLocalDev = process.env.LOCAL_DEV === 'true';
const SLUG = 'mcp-web-map';

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
