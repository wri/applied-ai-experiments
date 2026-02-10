import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    fs: {
      // Allow reading from parent src directory for stories
      allow: [
        path.resolve(__dirname, '..'),
        path.resolve(__dirname, '../../..'), // Allow workspace root for dependencies
      ],
    },
  },
  resolve: {
    alias: {
      '$ui': path.resolve(__dirname, '../src'),
    },
  },
  optimizeDeps: {
    include: ['marked', 'shiki'],
  },
});
