import { defineConfig } from 'vite';

export default defineConfig({
  root: 'landing-page',
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: '../dist-landing',
  },
});
