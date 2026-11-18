import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import tokens from '../../brand/tokens.json';
import { tokenCss } from '../../brand/tokens-css.ts';

const pages = ['index', 'invite/index', 'support/index', 'privacy/index', 'terms/index', '404'];

// Pointing at a link for a moment prerenders that page, so it opens at once. Only Chrome and Edge read these rules.
const speculation = { prerender: [{ where: { href_matches: '/*' }, eagerness: 'moderate' }] };

// Each page gets the token variables, a browser bar color for each appearance, and the OS text size.
// After a build, each page also preloads the Latin font file, so text does not change font after the first paint.
const brand = {
  name: 'deseo-tokens',
  transformIndexHtml: {
    order: 'post',
    handler: (html, { bundle }) => {
      const font = bundle && Object.values(bundle).find((file) => file.name === 'manrope-latin-wght-normal.woff2');
      return [
        { tag: 'meta', attrs: { name: 'text-scale', content: 'scale' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'theme-color', content: tokens.colors.canvas, media: '(prefers-color-scheme: light)' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'theme-color', content: tokens.darkColors.canvas, media: '(prefers-color-scheme: dark)' }, injectTo: 'head' },
        ...(font ? [{ tag: 'link', attrs: { rel: 'preload', href: '/' + font.fileName, as: 'font', type: 'font/woff2', crossorigin: '' }, injectTo: 'head' }] : []),
        { tag: 'style', children: tokenCss, injectTo: 'head' },
        { tag: 'script', attrs: { type: 'speculationrules' }, children: JSON.stringify(speculation), injectTo: 'head' },
      ];
    },
  },
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
