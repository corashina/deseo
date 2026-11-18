import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { tokenCss } from '../../brand/tokens-css.ts';

// The token variables load as a stylesheet in the bundle, so no script writes a style element.
const tokens: Plugin = {
  name: 'deseo-tokens',
  resolveId: id => id === 'virtual:tokens.css' ? '\0virtual:tokens.css' : undefined,
  load: id => id === '\0virtual:tokens.css' ? tokenCss : undefined,
};

// A built page runs only its own scripts and styles, and talks only to Supabase.
// Trusted Types stop any script from writing HTML strings into the page. Dev mode skips the policy, because Vite injects inline scripts there.
function policy(supabaseUrl: string): Plugin {
  const { origin } = new URL(supabaseUrl);
  const content = ["default-src 'self'", "script-src 'self'", "style-src 'self'", "img-src 'self' blob: data:", "font-src 'self'",
    `connect-src 'self' ${origin} ${origin.replace(/^http/, 'ws')}`, "object-src 'none'", "base-uri 'none'", "form-action 'self'",
    "require-trusted-types-for 'script'", "trusted-types 'none'"].join('; ');
  return {
    name: 'deseo-policy',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content }, injectTo: 'head-prepend' }],
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tokens, policy(loadEnv(mode, import.meta.dirname).VITE_SUPABASE_URL ?? 'http://127.0.0.1')],
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
}));
