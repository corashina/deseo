import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const pages = ['index', 'invite/index', 'support/index', 'privacy/index', 'terms/index', '404'];

export default defineConfig({
  appType: 'mpa',
  build: {
    rolldownOptions: {
      input: Object.fromEntries(pages.map((page) => [page, resolve(import.meta.dirname, `${page}.html`)])),
    },
  },
  server: { host: '127.0.0.1', port: 5175, strictPort: true },
  preview: { host: '127.0.0.1', port: 4175, strictPort: true },
});
