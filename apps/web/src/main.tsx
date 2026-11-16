import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from './lib/query-client';
import { getSupabase } from './lib/supabase';
import { router } from './app/router';
import tokens from '../../../brand/tokens.json';
import '@fontsource-variable/manrope/index.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/controls.css';
for (const [name, value] of Object.entries(tokens.colors)) document.documentElement.style.setProperty('--' + name.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase()), value);
for (const [name, value] of Object.entries(tokens.space)) document.documentElement.style.setProperty('--space-' + name, value + 'px');
for (const [name, value] of Object.entries(tokens.radius)) document.documentElement.style.setProperty('--radius-' + name, value + 'px');
document.documentElement.style.setProperty('--nav-target', tokens.touchTarget + 'px');
const root = createRoot(document.getElementById('root')!);
try {
  getSupabase();
  root.render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>);
} catch (error) {
  root.render(<main className="card form-page"><h1>Deseo needs a connection</h1><p role="alert">{error instanceof Error ? error.message : 'Check the Supabase settings.'}</p></main>);
}
