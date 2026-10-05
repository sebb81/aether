import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve('apps/desktop/renderer'),
  base: './',
  plugins: [{
    name: 'aether-development-styles', apply: 'serve',
    transformIndexHtml: html => html.replace("style-src 'self';", "style-src 'self' 'unsafe-inline';"),
  }],
  build: { outDir: resolve('dist/renderer'), emptyOutDir: true },
  server: { host: '127.0.0.1', port: 5177, strictPort: true },
});
