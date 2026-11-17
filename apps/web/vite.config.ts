import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const api = loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL;
  return {
    // The first data request goes to Supabase. Open its connection while the page script loads.
    plugins: [react(), { name: 'preconnect-supabase', transformIndexHtml: () => api ? [{ tag: 'link', attrs: { rel: 'preconnect', href: new URL(api).origin, crossorigin: true }, injectTo: 'head' as const }] : [] }],
    server: { host: '127.0.0.1', port: 5174, strictPort: true },
    preview: { host: '127.0.0.1', port: 4174, strictPort: true },
  };
});
