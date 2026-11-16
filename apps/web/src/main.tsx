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
// Controls load before the shell, so shell rules can refine them.
import './styles/controls.css';
import './styles/shell.css';
const cssName = (name: string) => '--' + name.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
const declarations = (values: Record<string, string>) => Object.entries(values).map(([name, value]) => cssName(name) + ':' + value).join(';');
const layout = { ...Object.fromEntries(Object.entries(tokens.space).map(([name, value]) => ['space-' + name, value + 'px'])),
  ...Object.fromEntries(Object.entries(tokens.radius).map(([name, value]) => ['radius-' + name, value + 'px'])), navTarget: tokens.touchTarget + 'px' };
// One style element holds both palettes. The device appearance picks one, and no script runs when it changes.
const style = document.createElement('style');
style.id = 'tokens';
style.textContent = `:root{${declarations(tokens.colors)};${declarations(layout)}}@media (prefers-color-scheme: dark){:root{${declarations(tokens.darkColors)}}}`;
document.head.append(style);
const root = createRoot(document.getElementById('root')!);
try {
  getSupabase();
  root.render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>);
} catch (error) {
  root.render(<main className="card form-page"><h1>Deseo needs a connection</h1><p role="alert">{error instanceof Error ? error.message : 'Check the Supabase settings.'}</p></main>);
}
