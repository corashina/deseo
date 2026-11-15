import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export type LocalStatus = { API_URL: string; PUBLISHABLE_KEY: string; SERVICE_ROLE_KEY: string };

// Read keys from the running local stack. Keys stay in this process.
export function localStatus(): LocalStatus {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const cli = fileURLToPath(new URL('../../node_modules/supabase/dist/supabase.js', import.meta.url));
  const output = execFileSync(process.execPath, [cli, '--workdir', root, 'status', '-o', 'json'], { encoding: 'utf8', windowsHide: true });
  const status = JSON.parse(output) as LocalStatus;
  const url = new URL(status.API_URL);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.port !== '55721') throw new Error('Use the local deseo stack.');
  return status;
}
