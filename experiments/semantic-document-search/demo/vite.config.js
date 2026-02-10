import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		exclude: ['@huggingface/transformers']
	},
	worker: {
		format: 'es'
	},
	build: {
		target: 'esnext'
	}
});
