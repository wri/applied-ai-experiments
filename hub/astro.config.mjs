import { defineConfig } from 'astro/config';

// Use LOCAL_DEV=true for local development (no base path)
const isLocalDev = process.env.LOCAL_DEV === 'true';

export default defineConfig({
  site: isLocalDev ? 'http://localhost:8080' : 'https://wri.github.io',
  base: isLocalDev ? '/' : '/applied-ai-experiments',
  // For local dev, output to dist root; for prod, output to dist/hub for GitHub Pages
  outDir: isLocalDev ? '../dist' : '../dist/hub',
  build: {
    assets: '_assets'
  }
});
