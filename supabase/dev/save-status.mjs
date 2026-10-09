import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const backendRoot = process.argv[2];
if (!backendRoot) throw new Error('Pass the verified backend root.');
const folder = new URL('../../.superpowers/backend/', import.meta.url);
mkdirSync(folder, { recursive: true });
const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../node_modules/supabase/dist/supabase.js', import.meta.url)),
  '--workdir', backendRoot, 'status', '-o', 'json'], { encoding: 'utf8', windowsHide: true,
  env: { ...process.env, DO_NOT_TRACK: '1', SUPABASE_TELEMETRY_DISABLED: 'true' } });
writeFileSync(new URL('status.stderr.local.log', folder), result.stderr ?? '');
if (result.error || result.status !== 0) throw new Error('Read .superpowers/backend/status.stderr.local.log.');
const status = JSON.parse(result.stdout);
if (status.API_URL !== 'http://127.0.0.1:55721') throw new Error('Unexpected deseo API address.');
writeFileSync(new URL('status.local.json', folder), JSON.stringify(status, null, 2));
console.log('Saved deseo status in .superpowers/backend/status.local.json.');
