import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import tokens from '../../brand/tokens.json';
import { tokenCss } from '../../brand/tokens-css.ts';

const pages = ['index', 'invite/index', 'support/index', 'privacy/index', 'terms/index', '404'];

// Each page gets the token variables and a browser bar color for each appearance.
const brand = {
  name: 'deseo-tokens',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { name: 'theme-color', content: tokens.colors.canvas, media: '(prefers-color-scheme: light)' }, injectTo: 'head' },
    { tag: 'meta', attrs: { name: 'theme-color', content: tokens.darkColors.canvas, media: '(prefers-color-scheme: dark)' }, injectTo: 'head' },
    { tag: 'style', children: tokenCss, injectTo: 'head' },
  ],
};

export default defineConfig({
  appType: 'mpa',
  plugins: [brand],
  build: {
    rolldownOptions: {
      input: Object.fromEntries(pages.map((page) => [page, resolve(import.meta.dirname, `${page}.html`)])),
    },
  },
  server: { host: '127.0.0.1', port: 5175, strictPort: true },
  preview: { host: '127.0.0.1', port: 4175, strictPort: true },
});
