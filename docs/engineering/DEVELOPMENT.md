# Development

Use Node 24.18.0, npm 11.16.0, and the committed root lockfile.
Read AGENTS.md, STYLE.md, the approved portal design, ARCHITECTURE.md, and DATA.md before product work.

## 1. Install and verify source

Run these commands from the repository root:

```powershell
npm ci
npm run verify:mobile
npm run test:domain
```

Mobile verification runs native TypeScript, lint, and Jest. It does not require Docker.
The domain suite checks shared schemas, payloads, and results.
Keep exact pins. Add packages only when a feature needs them.

## 2. Local browser backend

Run Docker Desktop. Use the guarded dedicated `deseo-web` project under `.superpowers/web-backend`.
Its API uses 55721, database 55722, mail 55724, and inspector 55728.
The separate `deseo-integration` project uses 55620–55629.

```powershell
npm run prepare:web:backend
npm run start:web:backend
```

Set CLI telemetry controls before direct commands:

```powershell
$env:DO_NOT_TRACK = '1'
$env:SUPABASE_TELEMETRY_DISABLED = 'true'
```

Save this helper as `.superpowers/web-backend/save-status.cjs`:

```javascript
const { spawnSync } = require('node:child_process');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
const workdir = process.argv[2];
const run = spawnSync(process.execPath,
  ['node_modules/supabase/dist/supabase.js', '--workdir', workdir, 'status', '-o', 'json'],
  { encoding: 'utf8', windowsHide: true });
writeFileSync(join(workdir, 'status.stderr.local.log'), run.stderr ?? '');
if (run.error || run.status !== 0) throw new Error('Read the private status error log.');
writeFileSync(join(workdir, 'status.local.json'), run.stdout, 'utf8');
```

```powershell
node .superpowers/web-backend/save-status.cjs .superpowers/web-backend
```

The helper writes UTF-8 without a BOM. Keep the ignored files private; do not print keys.
Create `apps/web/.env.local` from `.env.example` and use the local publishable key.

| Browser variable | Use |
|---|---|
| `VITE_SUPABASE_URL` | API address; local value `http://127.0.0.1:55721` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public browser key |

Browser invitations use `location.origin`. The portal has no separate site-URL environment setting.
Do not add the unused planned `VITE_SITE_URL` variable.

## 3. One Edge origin

Start one Edge process in a separate terminal. Stop it before changing modes.

Development:

```powershell
npm run start:web:functions -- -Mode Development
npm run dev:web
```

Tests:

```powershell
npm run start:web:functions -- -Mode Test
npm run verify:web
```

Run each second command in another terminal while Edge remains active.
Development uses `http://127.0.0.1:5174`. Tests use `http://127.0.0.1:4174`.
Stop the other portal server before switching modes. The guarded script rejects the conflicting listener.
Playwright starts and stops its own preview. Run Windows browser checks elevated for Docker and owned process teardown.

| Server variable | Use |
|---|---|
| `WEB_APP_ORIGIN` | One exact browser origin selected by mode |
| `PUBLIC_SUPABASE_URL` | Reachable public API address for signed media links |
| `SUPABASE_URL` | Runtime-injected internal address for server calls |

Keep injected internal configuration intact. A deployed public API address must also be reachable by mobile devices.

Local Kong intercepts OPTIONS and stamps wildcard CORS headers.
The handler rejects unknown and null origins before work. Native calls can omit Origin.
See [the handoff](../handoffs/web-portal.md) for live measurements and deployment limits.

## 4. Named pair and gallery

With the local backend and Edge process running:

```powershell
npm run seed:web
```

The command creates or reuses Anna and Marek with stable content IDs.
Their emails are `anna@deseo.example.test` and `marek@deseo.example.test`.
Use the ordinary sign-in screen and codes from the local mail inbox at `http://127.0.0.1:55724`.

Open [the gallery](../design/web-portal/index.html) for route, state, viewport, and fixture evidence.
Use disposable fixtures for failures, end-pair actions, and destructive tests.
Remove only IDs recorded by ownership journals. Preserve unknown rows and user edits.

## 5. Backend checks and clean replay

Check the populated web database without resetting it:

```powershell
npm run test:web:db
```

SQL suites use fixed fixture IDs inside transactions and roll back their changes.
Do not run race workers alongside browser fixtures. Global worker claims need their own test window.
Race harnesses accept only supported loopback projects; notification races also require an empty notification table.

Use a new project for a clean replay. Copy config, migrations, tests, and templates into its `supabase` directory.
Before starting, inspect Docker containers, volumes, project labels, workdir, and ports.
Do not reuse a populated project or volume.

The final replay used project `deseo-web-replay` with database 55822 and shadow database 55820.
It copied the current config, changed the project ID and ports, and disabled the absent seed file.
It used supported Postgres-only commands:

```powershell
npx supabase --workdir <fresh-replay-directory> db start
npx supabase --workdir <fresh-replay-directory> db reset --local
npx supabase --workdir <fresh-replay-directory> test db --local
```

Keep replay logs before removing only its verified container and volume.
The final replay did not reset `deseo-web` or `deseo-integration`.

The memory race harness removes claimed objects. Use the isolated replay project when populated stacks contain unknown cleanup jobs.
The final memory race target used replay API 55821.
The CLI short-circuits `start` while its Postgres-only container runs.
Stop only that verified replay project with data preservation, then start its required services:

```powershell
npx supabase --workdir <fresh-replay-directory> stop --project-id deseo-web-replay
npx supabase --workdir <fresh-replay-directory> start -x realtime,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor,mailpit
node .superpowers/web-backend/save-status.cjs <fresh-replay-directory>
```

Verify the new services' project labels, workdir, and API address before testing.
The exclusions keep Edge runtime off. The original Edge process remains separate.
Core and notification races can use API 55721 during their dedicated test window.
Load each target's keys inside the Node test process and pass them only through its child environment.

Save this helper as `.superpowers/web-backend/run-races.cjs`:

```javascript
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const suites = {
  core: ['pairing-races', 'planning-races', 'messages-races'],
  memories: ['memories-races'],
  notifications: ['notification-races'],
};
const suite = process.argv[2];
const status = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
assert(suites[suite]);
assert.equal(status.API_URL, suite === 'memories'
  ? 'http://127.0.0.1:55821' : 'http://127.0.0.1:55721');
assert(status.PUBLISHABLE_KEY && status.SERVICE_ROLE_KEY);
const run = spawnSync(process.execPath, ['--experimental-strip-types', '--test',
  ...suites[suite].map(name => 'supabase/tests/' + name + '.test.ts')], {
  stdio: 'inherit',
  env: { ...process.env,
    SUPABASE_TEST_URL: status.API_URL,
    SUPABASE_TEST_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
    SUPABASE_TEST_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  },
});
if (run.error) throw run.error;
process.exit(run.status ?? 1);
```

Run it from the repository root after verifying each stack's identity:

```powershell
node .superpowers/web-backend/run-races.cjs core .superpowers/web-backend/status.local.json
node .superpowers/web-backend/run-races.cjs notifications .superpowers/web-backend/status.local.json
node .superpowers/web-backend/run-races.cjs memories <fresh-replay-directory>/status.local.json
```

These calls match the root race scripts. Their keys stay inside the Node process and its child.

Run Edge checks from the root:

```powershell
npm run test:memories:functions
npm run typecheck:memories:functions
npm run test:notifications:functions
npm run typecheck:notifications:functions
npm exec --yes --package deno@2.9.6 -- deno check --frozen --config supabase/functions/verify-sensitive-action/deno.json supabase/functions/verify-sensitive-action/index.ts
```

The sensitive function has its own committed dependency map. Use its config for standalone checks.
Discover CLI options through the installed help before changing commands.

## 6. Expo mobile

Copy `apps/mobile/.env.example` to its `.env.local` before connecting a native build.
Use `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for that backend.
Native links use `EXPO_PUBLIC_SITE_URL`; configured development push uses `EXPO_PUBLIC_EAS_PROJECT_ID`.
These values are public build configuration. Keep server keys out of them.

A phone's loopback address refers to that phone. Use an API address the device can reach.
Android emulators can use `10.0.2.2`; physical devices need a reachable host address.

```powershell
npm run dev:mobile
npm run android --workspace @deseo/mobile
npm run ios --workspace @deseo/mobile
npm exec --workspace @deseo/mobile -- expo export --platform android --platform ios --output-dir dist
```

MMKV needs a development build. Expo Go cannot run its native storage.
Android requires installed Android tooling. iOS local builds require macOS and Xcode.
JavaScript exports verify bundling; physical device, push, native binary, and store checks remain separate.

## 7. Implementation rules

Rate tests before writing them. Implement only tests scoring at least 90.
Use feature public interfaces and shared domain contracts. Keep database calls out of screens.
Run focused checks during a fix, then one fresh full check on final source.
Preserve failed logs and state each rerun's scope.
Generate database types after schema changes. Test fresh replay and populated fixtures.
Keep account, pair, and private-state cleanup contracts intact.

The [portal handoff](../handoffs/web-portal.md) records current results, dependency findings, and remaining acceptance work.
