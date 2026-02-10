import adapter from '@sveltejs/adapter-static';

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('dev');
const isLocalDev = process.env.LOCAL_DEV === 'true';

const SLUG = 'ai-provisioning-guide';

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
			base: isDev ? '' : (isLocalDev ? `/${SLUG}` : `/applied-ai-experiments/${SLUG}`)
		}
	}
};

export default config;
