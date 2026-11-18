import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from './lib/query-client';
import { getSupabase } from './lib/supabase';
import { router } from './app/router';
import '@fontsource-variable/manrope/index.css';
// Token variables from brand/tokens.json. vite.config.ts builds this stylesheet.
import 'virtual:tokens.css';
import './styles/tokens.css';
import './styles/base.css';
// Controls load before the shell, so shell rules can refine them.
import './styles/controls.css';
import './styles/shell.css';
const root = createRoot(document.getElementById('root')!);
try {
  getSupabase();
  root.render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>);
} catch (error) {
  root.render(<main className="card form-page"><h1>Deseo needs a connection</h1><p role="alert">{error instanceof Error ? error.message : 'Check the Supabase settings.'}</p></main>);
}
