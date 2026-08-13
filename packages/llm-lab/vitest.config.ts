import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [svelte({ hot: false, compilerOptions: { css: 'injected' } })],
  resolve: {
    conditions: ['browser'],
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    globals: true,
    css: false,
  },
});
