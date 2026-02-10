import { defineConfig } from 'astro/config';

// Use LOCAL_DEV=true for local development (no base path)
const isLocalDev = process.env.LOCAL_DEV === 'true';

export default defineConfig({
  site: isLocalDev ? 'http://localhost:8080' : 'https://wri.github.io',
  base: isLocalDev ? '/' : '/applied-ai-experiments',
  outDir: '../dist',
  build: {
    assets: '_assets'
  }
});
